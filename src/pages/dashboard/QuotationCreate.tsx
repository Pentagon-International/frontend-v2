import {
  Box,
  Group,
  Grid,
  SegmentedControl,
  TextInput,
  Textarea,
  Button,
  Text,
  Stack,
  Modal,
  Radio,
  Tooltip,
  Skeleton,
  Loader,
  Center,
  Card,
  Badge,
  Table,
  ScrollArea,
  Flex,
  Menu,
  ActionIcon,
  Checkbox,
} from "@mantine/core";
import {
  carrierDisplayFormat,
  carrierTransportParamsFromService,
  formatCarrierDisplayValue,
  parseCarrierNameFromLabel,
} from "../../utils/carrierSelect";
import { DateInput } from "@mantine/dates";
import { useForm, yupResolver } from "@mantine/form";
import * as Yup from "yup";
import {
  IconCalendar,
  IconCheck,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconHistory,
  IconDotsVertical,
  IconChartBar,
  IconDatabase,
  IconBook,
  IconNotes,
  IconUser,
  IconTruckDelivery,
  IconFileText,
  IconCircleCheck,
} from "@tabler/icons-react";
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import dayjs from "dayjs";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { postAPICall } from "../../service/postApiCall";
import { putAPICall } from "../../service/putApiCall";
import { toTitleCase } from "../../utils/textFormatter";
import {
  coerceHouseCargoWeightInput,
  importHouseCargoWeightFromApi,
  parseNoOfUnitForPayload,
} from "../../utils/houseCargoChargeableWeight";
import {
  ToastNotification,
  ServiceDetailsSlider,
  Dropdown,
  SearchableSelect,
  SingleDateInput,
} from "../../components";
import FormNumberInput from "../../components/FormNumberInput";
import EditPageAuditInfoIcon from "../../components/EditPageAuditInfoIcon";
import {
  EDIT_PAGE_AUDIT_SIDEBAR_Z_INDEX,
  normalizeEditPageAuditInfo,
} from "../../utils/editPageAuditInfo";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../store/authStore";
import { useExchangeRateRoe } from "../../hooks/useExchangeRateRoe";
import { parseBookingRoe } from "../../hooks/useBookingChargesRoe";
import {
  formatRoeAsString,
  parseRoeForPayload,
  sanitizeRoeInput,
} from "../../utils/exchangeRateRoe";
import {
  bindMoneyWholeNumberMode,
  clampCurrencyMoneyAmountBound,
  clampMoneyAmountBound,
  formatMoneyAmount,
  formatMoneyAmountBound,
  formatMoneyAmountForUi,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
} from "../../utils/nonDecimalMoneyAmount";
import DirectQuoteEnquiryFields from "./DirectQuoteEnquiryFields";
import { buildEnquiryServicePayload } from "../../utils/buildEnquiryServicePayload";
import { buildCustomerCreatePayloadFields } from "../../utils/customerSelection";
import {
  getBookingCreatePath,
  type OtherServiceOption,
} from "../../utils/otherServiceType";

/** Currency / per-unit amounts: always 2 decimal places. */
function clampCurrencyAmount(value: number | null | undefined): number | null {
  return clampCurrencyMoneyAmountBound(value);
}

/** Local totals (Total Sell/Cost in branch currency): whole numbers for Vietnam. */
function clampLocalAmount(value: number | null | undefined): number | null {
  return clampMoneyAmountBound(value);
}

/** Form money string → NumberInput value (empty stays undefined). */
function moneyFormValueToNumber(
  value: string | number | null | undefined,
): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** NumberInput onChange → form string for currency / per-unit fields (always 2 dp). */
function currencyNumberInputToFormString(value: string | number): string {
  if (value === "" || value === null || value === undefined) return "";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return "";
  return formatMoneyAmount(n, false);
}

/** API/rate value → form string for currency / per-unit fields (always 2 dp). */
function currencyApiValueToFormString(value: unknown): string {
  if (value === "" || value === null || value === undefined) return "";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return "";
  return formatMoneyAmount(n, false);
}

/** API value → form string for Total Sell/Cost (Vietnam whole-number mode). */
function localApiValueToFormString(value: unknown): string {
  if (value === "" || value === null || value === undefined) return "";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return "";
  return formatMoneyAmountBound(n);
}

/** Currency / per-unit → payload number (always 2 dp). */
function parseCurrencyMoneyForPayload(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return 0;
  return clampCurrencyAmount(n) ?? 0;
}

/** Total Sell/Cost → payload number (Vietnam whole-number mode). */
function parseLocalMoneyForPayload(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return 0;
  return clampLocalAmount(n) ?? 0;
}

function formatHistoryCurrencyMoney(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "-";
  const n = parseFloat(String(raw));
  if (!Number.isFinite(n)) return "-";
  return formatMoneyAmountForUi(n, false);
}

function formatHistoryLocalMoney(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "-";
  const n = parseFloat(String(raw));
  if (!Number.isFinite(n)) return "-";
  return formatMoneyAmountForUi(n);
}

const QUOTATION_APPROVAL_PATH = "/quotation-approval";
const QUOTATION_MASTER_PATH = "/quotation";

type QuotationHeaderRemarkSource = {
  status?: string;
  reject_remark?: string | null;
};

/** LOST quotations use top-level reject_remark; other statuses use service-level remark. */
function resolveQuotationRemark(
  headerData: QuotationHeaderRemarkSource | null | undefined,
  serviceRemark?: string | null,
): string {
  const status = String(headerData?.status ?? "")
    .trim()
    .toUpperCase();
  if (status === "LOST") {
    return headerData?.reject_remark?.trim() || "";
  }
  return serviceRemark?.trim() || "";
}

type RemarkInputWithTooltipProps = {
  value: string;
  error?: string;
  isRemarkRequired: boolean;
  isViewMode: boolean;
  onChange: (value: string) => void;
};

function RemarkInputWithTooltip({
  value,
  error,
  isRemarkRequired,
  isViewMode,
  onChange,
}: RemarkInputWithTooltipProps) {
  const trimmed = value?.trim() ?? "";

  return (
    <Tooltip
      label={value}
      multiline
      w={320}
      position="top"
      withArrow
      disabled={!trimmed}
      events={{ hover: true, focus: true, touch: true }}
      styles={{
        tooltip: {
          fontFamily: "Inter",
          fontSize: 12,
          whiteSpace: "pre-wrap",
        },
      }}
    >
      <div style={{ width: "100%" }}>
        <TextInput
          label="Remark"
          withAsterisk={isRemarkRequired}
          placeholder="Enter remark"
          value={value}
          onChange={(e) => {
            if (!isViewMode) {
              onChange(toTitleCase(e.target.value));
            }
          }}
          readOnly={isViewMode}
          disabled={isViewMode}
          styles={{
            input: {
              fontSize: "14px",
              fontFamily: "Inter",
              height: "36px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
            label: {
              fontSize: "14px",
              fontWeight: 500,
              color: "#424242",
              marginBottom: "4px",
              fontFamily: "Inter",
              fontStyle: "medium",
            },
          }}
          error={error}
        />
      </div>
    </Tooltip>
  );
}

const quotationFormSchema = (isRemarkRequired: boolean) =>
  Yup.object().shape({
    quote_currency_country_code: Yup.string().required("Currency is required"),
    valid_upto: Yup.string().required("Valid upto date is required"),
    multi_carrier: Yup.string().required("Carrier type is required"),
    quote_type: Yup.string().required("Quote type is required"),
    carrier_code: Yup.string(),
    remark: Yup.string().when([], {
      is: () => isRemarkRequired,
      then: (schema) => schema.required("Remark is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
  });

const dynamicFormSchema = Yup.object().shape({
  charges: Yup.array()
    .of(
      Yup.object().shape({
        charge_name: Yup.string().required("Charge name is required"),
        currency_country_code: Yup.string().required("Currency is required"),
        roe: Yup.number()
          .typeError("ROE is required")
          .required("ROE is required"),
        unit: Yup.string().required("Unit is required"),
        no_of_units: Yup.number()
          .typeError("Must be a number")
          .nullable()
          .transform((value, originalValue) =>
            originalValue === "" ? null : value,
          ),
        sell_per_unit: Yup.number()
          .typeError("Sell per unit is required")
          .required("Sell/unit required"),
        min_sell: Yup.number()
          .typeError("Must be a number")
          .nullable()
          .transform((value, originalValue) =>
            originalValue === "" ? null : value,
          ),
        cost_per_unit: Yup.number()
          .typeError("Must be a number")
          .nullable()
          .transform((value, originalValue) =>
            originalValue === "" ? null : value,
          ),
        // min_cost: Yup.number()
        //   .typeError("Must be a number")
        //   .nullable()
        //   .transform((value, originalValue) =>
        //     originalValue === "" ? null : value
        //   ),
      }),
    )
    .min(1, "At least one charge is required"),
});

const destinationOptionSchema = Yup.object().shape({
  tariffVal: Yup.string()
    // .oneOf(
    //   ["all_inclusive", "per_container", "as_per_tariff"],
    //   "Select a valid tariff option"
    // )
    .required("Please select a tariff option"),
});

type ChargeType = {
  charge_name: string;
  // charge master id (optional for legacy/default charges)
  charge_id?: number | string | null;
  currency_country_code: string;
  roe: number | string;
  unit: string;
  no_of_units: string;
  sell_per_unit: string;
  min_sell: string;
  cost_per_unit: string;
  total_cost: string;
  total_sell: string;
  // min_cost: string;
  toBeDisabled?: boolean;
  // Present only for existing quotation charges (line items)
  id?: number;
};

function formatQuotationNoOfUnitsFromApi(value: unknown): string {
  const imported = importHouseCargoWeightFromApi(value);
  return imported === null ? "" : String(imported);
}

function computeChargeLineTotals(charge: {
  no_of_units?: string | number;
  sell_per_unit?: string | number;
  cost_per_unit?: string | number;
  roe?: string | number;
}): { total_sell: string; total_cost: string } {
  const noOfUnits = parseFloat(String(charge.no_of_units ?? "")) || 0;
  const sellPerUnit = parseFloat(String(charge.sell_per_unit ?? "")) || 0;
  const costPerUnit = parseFloat(String(charge.cost_per_unit ?? "")) || 0;
  const roe = parseFloat(String(charge.roe ?? "")) || 1;
  const calculatedSell = noOfUnits * sellPerUnit * roe;
  const calculatedCost = noOfUnits * costPerUnit * roe;
  const format = (value: number) =>
    formatMoneyAmountBound(Number.isFinite(value) ? value : 0);
  return {
    total_sell: format(calculatedSell),
    total_cost: format(calculatedCost),
  };
}

function getQuoteCurrencyRoeFromCharges(
  quoteCurrency: string,
  chargeList: Array<{ currency_country_code?: string; roe?: string | number }>,
): number {
  const normalizedQuote = quoteCurrency.trim().toUpperCase();
  if (!normalizedQuote) return 1;

  for (const charge of chargeList) {
    const chargeCurrency = String(charge.currency_country_code ?? "")
      .trim()
      .toUpperCase();
    if (chargeCurrency !== normalizedQuote) continue;

    const roe = parseFloat(String(charge.roe ?? ""));
    if (!Number.isNaN(roe) && roe > 0) return roe;
    return 1;
  }

  return 1;
}

type CurrencyItem = {
  code: string;
  name: string;
};

type CarrierItem = {
  carrier_code: string;
  carrier_name: string;
};

type ServiceDetail = {
  id: number;
  service: "AIR" | "FCL" | "LCL";
  trade: "Export" | "Import";
  origin_code_read: string;
  origin_name: string;
  destination_code_read: string;
  destination_name: string;
  pickup: boolean;
  delivery: boolean;
  pickup_location: string;
  delivery_location: string;
  hazardous_cargo: boolean;
  shipment_terms_code_read: string;
  shipment_terms_name: string;
  fcl_details?: Array<{
    id: number;
    container_type: string;
    container_name: string;
    no_of_containers: number;
    gross_weight: number | null;
  }>;
  no_of_packages?: number | null;
  gross_weight?: number | null;
  volume_weight?: number | null;
  chargeable_weight?: number | null;
  volume?: number | null;
  chargeable_volume?: number | null;
};

type QuotationCreateProps = {
  enquiryData?: {
    id: number;
    enquiry_id: string;
    actionType?: string;
    customer_code?: string; // Added for destination flow
    customer_name: string;
    temp_code?: string;
    enquiry_received_date: string;
    sales_person: string;
    sales_coordinator: string;
    customer_services: string;
    services?: ServiceDetail[];
    // Legacy single service support
    service?: "AIR" | "FCL" | "LCL";
    trade?: "Export" | "Import";
    origin_name?: string;
    destination_name?: string;
    pickup?: boolean;
    delivery?: boolean;
    pickup_location?: string;
    delivery_location?: string;
    hazardous_cargo?: boolean;
    no_of_packages?: number | null;
    gross_weight?: number | null;
    volume_weight?: number | null;
    chargeable_weight?: number | null;
    volume?: number | null;
    chargeable_volume?: number | null;
    container_type_name?: string;
    no_of_containers?: number;
    shipment_terms_name?: string;
    quoteType?: string;
    serviceQuotationState?: {
      [serviceId: number]: {
        quotationForm: any;
        dynamicForm: { charges: any[] };
        hasQuotation: boolean;
      };
    };
    quotationId?: number | string;
    quotation_id?: number | string;
  };
  goToStep?: (step: number) => void;
  quotationDataFromChatbot?: any;
  onSubmitRef?: React.MutableRefObject<(() => void) | null>;
};
type ChargeItem = {
  charge_name: string;
  currency_country_code: string;
  roe: string;
  unit: string;
  no_of_units: string;
  sell_per_unit: string;
  min_sell: string;
  cost_per_unit: string;
  // min_cost: string;
  toBeDisabled: boolean;
};

type ChargesDataItem = {
  enquiry_id: string;
  charges: Array<{
    charge_name: string;
    currency: string;
    unit: string;
    quantity: string;
    rate: string;
  }>;
};

type CarrierComparisonData = {
  enquiry_id: string;
  origin: string;
  destination: string;
  service: string;
  container_details: Array<{
    container_type: string;
    quantity: number;
  }>;
  main_carrier: Array<{
    carrier_name: string;
    carrier_code: string;
    all_inclusive_total: number;
  }>;
  Nvocc: Array<{
    carrier_name: string;
    carrier_code: string;
    all_inclusive_total: number;
  }>;

  total_carriers_found: number;
};

type EnquiryCreateApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id?: number;
    enquiry_id?: string;
    services?: Array<{
      id: number;
      service: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  id?: number;
  enquiry_id?: string;
  services?: Array<{
    id: number;
    service: string;
    [key: string]: unknown;
  }>;
};

function normalizeEnquiryCreateResponse(response: EnquiryCreateApiResponse | null) {
  if (!response) return null;
  if (response.data?.enquiry_id) return response.data;
  if (response.enquiry_id) return response;
  return null;
}

function resolveEnquiryServiceId(
  originalServiceId: string | number,
  enquiryServices: Array<{ id: number }>,
): number {
  const numericId = Number(originalServiceId);
  if (!enquiryServices.length || Number.isNaN(numericId)) return numericId;

  const directMatch = enquiryServices.find((service) => service.id === numericId);
  if (directMatch) return directMatch.id;

  // Direct-quote flow uses 1-based temp ids aligned with service order
  const orderIndex = numericId - 1;
  if (orderIndex >= 0 && orderIndex < enquiryServices.length) {
    return enquiryServices[orderIndex].id;
  }

  return numericId;
}

const INPUT_CONTAINER_MAX_HEIGHT = 360;

function QuotationCreate({
  enquiryData,
  goToStep,
  quotationDataFromChatbot,
}: QuotationCreateProps) {
  const user = useAuthStore((state) => state.user);
  const isManagerOrAdmin = Boolean(user?.is_manager || user?.is_staff);
  const isVietnamBranch = useMemo(
    () => isVietnamBranchFromUser(user),
    [user],
  );
  bindMoneyWholeNumberMode(isVietnamBranch);
  const currencyAmountDecimalScale = getAmountDecimalScale(false);
  // Total Sell/Cost are VND (branch) local amounts — whole numbers for Vietnam.
  const localAmountDecimalScale = getAmountDecimalScale(isVietnamBranch);
  const queryClient = useQueryClient();
  const [chargesData, setCharges] = useState<ChargesDataItem[]>([]);
  const {
    defaultBranchCurrency,
    isBaseCurrency,
    ensureRoeForCurrency,
    validateRoeField,
    ROE_CANNOT_BE_ONE_FIELD,
    ROE_CANNOT_BE_ONE_TOAST,
  } = useExchangeRateRoe();
  const branchCurrencyCode = defaultBranchCurrency;
  const formatMoneyDisplay = useCallback(
    (value: number) => formatMoneyAmountForUi(value),
    // Recompute when Vietnam mode changes (bound formatter reads session flag).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isVietnamBranch],
  );
  const [chargeRoeErrors, setChargeRoeErrors] = useState<
    Record<number, string>
  >({});
  const [fetchedQuoteCurrencyRoe, setFetchedQuoteCurrencyRoe] = useState<
    number | null
  >(null);
  const [carrierComparisonData, setCarrierComparisonData] =
    useState<CarrierComparisonData | null>(null);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [selectedCarrierCode, setSelectedCarrierCode] = useState<string>("");
  const [tempSelectedCarrier, setTempSelectedCarrier] = useState<any>(null);
  const [
    carrierModalOpened,
    { open: openCarrierModal, close: closeCarrierModal },
  ] = useDisclosure(false);
  const [isSubmittingTariff, setIsSubmittingTariff] = useState(false);
  const [isSubmittingQuotation, setIsSubmittingQuotation] = useState(false);
  const [unfilledServicesModalOpened, setUnfilledServicesModalOpened] =
    useState(false);
  const [unfilledServices, setUnfilledServices] = useState<number[]>([]);
  const [unitData, setUnitData] = useState<any[]>([]);
  const [isLoadingUnitData, setIsLoadingUnitData] = useState(false);

  // Notes & Conditions state
  const [notesConditionsModalOpened, setNotesConditionsModalOpened] =
    useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [isLoadingNotesConditions, setIsLoadingNotesConditions] =
    useState(false);
  // Store fetched notes and conditions per service
  const [fetchedNotesConditions, setFetchedNotesConditions] = useState<{
    [serviceId: number]: {
      notes: string[];
      conditions: string[];
    };
  }>({});
  const notesScrollRef = useRef<HTMLDivElement>(null);
  const conditionsScrollRef = useRef<HTMLDivElement>(null);
  const [notesScrollable, setNotesScrollable] = useState(false);
  const [conditionsScrollable, setConditionsScrollable] = useState(false);
  const [notesAtBottom, setNotesAtBottom] = useState(true);
  const [conditionsAtBottom, setConditionsAtBottom] = useState(true);

  // Charge History state
  const [chargeHistoryModalOpened, setChargeHistoryModalOpened] =
    useState(false);
  const [chargeHistoryData, setChargeHistoryData] = useState<any[]>([]);
  const [isLoadingChargeHistory, setIsLoadingChargeHistory] = useState(false);

  // Service-specific state management
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);
  const [serviceQuotationData, setServiceQuotationData] = useState<{
    [serviceId: number]: {
      quotationForm: any;
      dynamicForm: any;
      hasQuotation: boolean;
    };
  }>({});

  // State to store fetched quotation data when ID is provided
  const [fetchedQuotationData, setFetchedQuotationData] = useState<any>(null);

  // Loading state for quotation data fetching
  const [isLoadingQuotationData, setIsLoadingQuotationData] = useState(false);

  const [opened, { open, close }] = useDisclosure(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { id: quotationId } = useParams<{ id: string }>();
  const isDirectQuoteFromList = Boolean(
    !enquiryData &&
      !goToStep &&
      location.state?.actionType === "createQuote" &&
      location.state?.fromQuotationList,
  );
  const [inlineEnquiryData, setInlineEnquiryData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const validateEnquiryRef = useRef<(() => boolean) | null>(null);
  const enquirySectionRef = useRef<HTMLDivElement>(null);
  const actualEnquiryDataRef = useRef<any>(null);
  const selectedServiceRef = useRef<any>(null);
  const fetchedDefaultChargesRef = useRef<Record<string, true>>({});
  const directQuoteChargesFilterRef = useRef<Record<number, string>>({});
  const lastInlineSyncKeyRef = useRef<string>("");
  console.log("location value-----", location);
  console.log("quotationId from params-----", quotationId);

  // Handle both scenarios: component usage and standalone route
  const quotationData = location.state;
  const baseEnquiryData = enquiryData || quotationData || fetchedQuotationData;
  const actualEnquiryData = useMemo(() => {
    if (isDirectQuoteFromList && inlineEnquiryData) {
      return { ...quotationData, ...inlineEnquiryData };
    }
    return baseEnquiryData;
  }, [baseEnquiryData, inlineEnquiryData, isDirectQuoteFromList, quotationData]);
  const isDirectQuoteCreateFlow = Boolean(
    (location.state?.actionType === "createQuote" &&
      (location.state?.fromDestination || location.state?.fromQuotationList)) ||
      (enquiryData?.actionType === "createQuote" &&
        (enquiryData?.fromDestination || enquiryData?.fromQuotationList)),
  );
  const isRemarkRequired =
    actualEnquiryData?.actionType === "edit" ||
    actualEnquiryData?.actionType === "editQuotation";

  console.log("Whole enquiry data---", actualEnquiryData);

  useEffect(() => {
    actualEnquiryDataRef.current = actualEnquiryData;
  }, [actualEnquiryData]);

  // Check if this is view mode (read-only) from dashboard
  const isViewMode = Boolean(
    location.state?.viewMode || quotationData?.viewMode,
  );

  // Check if this is edit mode (standalone route with quotation data)
  // Include quotationId check to handle navigation from dashboard
  const isStandaloneEdit =
    !enquiryData &&
    (quotationData || fetchedQuotationData || !!quotationId) &&
    (quotationData?.actionType === "edit" ||
      !!fetchedQuotationData ||
      !!quotationId) &&
    !isViewMode; // Not edit mode if in view mode
  const isEmbeddedEditMode = Boolean(
    enquiryData && enquiryData.actionType === "editQuotation",
  );
  const isEditMode = (isStandaloneEdit || isEmbeddedEditMode) && !isViewMode;
  const [auditInfoHovered, setAuditInfoHovered] = useState(false);
  const quotationAuditInfo = useMemo(
    () => normalizeEditPageAuditInfo(fetchedQuotationData || quotationData),
    [fetchedQuotationData, quotationData],
  );
  const quotationIdForEdit =
    actualEnquiryData?.actionType === "edit"
      ? actualEnquiryData?.id
      : actualEnquiryData?.actionType === "editQuotation"
        ? actualEnquiryData?.quotationId
        : null;

  // Simple navigation: managers/admins -> approval list, others -> regular list
  const navigateToPreferredList = (filtersToRestore?: any) => {
    const targetPath = QUOTATION_MASTER_PATH;

    if (filtersToRestore) {
      navigate(targetPath, {
        state: {
          restoreFilters: filtersToRestore,
          refreshData: true,
        },
      });
    } else {
      navigate(targetPath, { state: { refreshData: true } });
    }
  };

  // Extract services from enquiry data or quotation data (for edit mode)
  const services: ServiceDetail[] = useMemo(() => {
    // For edit mode, extract services from quotation data
    // Check both actualEnquiryData and fetchedQuotationData
    const quotationDataToUse =
      actualEnquiryData?.quotation || fetchedQuotationData?.quotation;
    // Check if we have quotation data (either standalone edit or from enquiryData)
    const hasQuotationData =
      quotationDataToUse &&
      Array.isArray(quotationDataToUse) &&
      quotationDataToUse.length > 0;
    if (
      (isEditMode || !!quotationId || hasQuotationData) &&
      quotationDataToUse &&
      Array.isArray(quotationDataToUse)
    ) {
      return quotationDataToUse.map((quotation: any) => ({
        id: quotation.service_id,
        service: quotation.service_type as "AIR" | "FCL" | "LCL" | "OTHERS",
        service_type: quotation.service_type, // Include service_type for OTHERS detection
        trade: quotation.trade as "Export" | "Import" | null,
        service_code: quotation.service_code || "", // Include service_code for OTHERS
        service_name: quotation.service_name || "", // Include service_name for OTHERS
        origin_code_read: quotation.origin_code || "",
        origin_name: quotation.origin || "",
        destination_code_read: quotation.destination_code || "",
        destination_name: quotation.destination || "",
        pickup: false, // Not available in quotation data
        delivery: false, // Not available in quotation data
        pickup_location: "",
        delivery_location: "",
        hazardous_cargo: quotation.hazardous_cargo || false,
        stackable:
          quotation.stackable !== undefined ? quotation.stackable : true, // Include stackable
        shipment_terms_code_read: quotation.shipment_terms_code || "",
        shipment_terms_name: quotation.shipment_terms || "",
        // Add FCL specific details if available
        // For OTHERS, let EnquiryCreate determine structure based on service_code lookup
        fcl_details:
          quotation.service_type === "FCL" && quotation.cargo_details
            ? quotation.cargo_details.map((cargo: any) => ({
                // id: Math.random(), // Generate temporary ID
                container_type_code: cargo.container_type_code,
                container_type: cargo.container_type || "",
                container_name: cargo.container_type || "",
                no_of_containers: cargo.no_of_containers || 0,
                gross_weight: cargo.gross_weight || null,
              }))
            : // For OTHERS, include fcl_details if cargo_details has container_type_code
              // EnquiryCreate will determine the correct structure based on service_code
              quotation.service_type === "OTHERS" &&
                quotation.cargo_details &&
                quotation.cargo_details.some((c: any) => c.container_type_code)
              ? quotation.cargo_details.map((cargo: any) => ({
                  container_type_code: cargo.container_type_code,
                  container_type: cargo.container_type || "",
                  container_name: cargo.container_type || "",
                  no_of_containers: cargo.no_of_containers || 0,
                  gross_weight: cargo.gross_weight || null,
                }))
              : undefined,
        // Add AIR/LCL specific details if available
        // For OTHERS, pass all cargo details - EnquiryCreate will determine structure
        no_of_packages:
          (quotation.service_type !== "FCL" &&
            quotation.cargo_details?.[0]?.no_of_packages) ||
          null,
        gross_weight: quotation.cargo_details?.[0]?.gross_weight || null,
        volume_weight:
          (quotation.service_type === "AIR" ||
            (quotation.service_type === "OTHERS" &&
              quotation.cargo_details?.[0]?.volume_weight)) &&
          quotation.cargo_details?.[0]?.volume_weight
            ? quotation.cargo_details[0].volume_weight
            : null,
        chargeable_weight:
          (quotation.service_type === "AIR" ||
            (quotation.service_type === "OTHERS" &&
              quotation.cargo_details?.[0]?.chargeable_weight)) &&
          quotation.cargo_details?.[0]?.chargeable_weight
            ? quotation.cargo_details[0].chargeable_weight
            : null,
        volume:
          (quotation.service_type === "LCL" ||
            (quotation.service_type === "OTHERS" &&
              quotation.cargo_details?.[0]?.volume)) &&
          quotation.cargo_details?.[0]?.volume
            ? quotation.cargo_details[0].volume
            : null,
        chargeable_volume:
          (quotation.service_type === "LCL" ||
            (quotation.service_type === "OTHERS" &&
              quotation.cargo_details?.[0]?.chargeable_volume)) &&
          quotation.cargo_details?.[0]?.chargeable_volume
            ? quotation.cargo_details[0].chargeable_volume
            : null,
      }));
    }

    // For create mode, use existing logic
    if (
      actualEnquiryData?.services &&
      Array.isArray(actualEnquiryData.services)
    ) {
      return actualEnquiryData.services;
    }
    // Legacy support for single service
    if (actualEnquiryData?.service) {
      return [
        {
          id: 1, // Default ID for legacy support
          service: actualEnquiryData.service,
          trade: actualEnquiryData.trade || "Export",
          origin_code_read: "",
          origin_name: actualEnquiryData.origin_name || "",
          destination_code_read: "",
          destination_name: actualEnquiryData.destination_name || "",
          pickup: actualEnquiryData.pickup || false,
          delivery: actualEnquiryData.delivery || false,
          pickup_location: actualEnquiryData.pickup_location || "",
          delivery_location: actualEnquiryData.delivery_location || "",
          hazardous_cargo: actualEnquiryData.hazardous_cargo || false,
          shipment_terms_code_read: "",
          shipment_terms_name: actualEnquiryData.shipment_terms_name || "",
        },
      ];
    }
    return [];
  }, [actualEnquiryData, isEditMode, quotationId, fetchedQuotationData]);

  // Get current selected service
  const selectedService = useMemo(() => {
    return services[selectedServiceIndex] || null;
  }, [services, selectedServiceIndex]);

  const carrierTransportModeParams = useMemo(
    () => carrierTransportParamsFromService(selectedService?.service),
    [selectedService?.service],
  );

  useEffect(() => {
    selectedServiceRef.current = selectedService;
  }, [selectedService]);

  const isDirectEnquiryComplete = useMemo(() => {
    if (!isDirectQuoteFromList) return true;
    const enq: any = actualEnquiryData;
    if (!enq?.customer_code || !enq?.enquiry_received_date || !enq?.sales_person)
      return false;
    const srv = Array.isArray(enq?.services) ? enq.services : [];
    if (!srv.length) return false;
    const isNonEmpty = (v: any) => String(v ?? "").trim().length > 0;

    for (const s of srv) {
      const serviceType = String(s?.service || "").toUpperCase();
      if (!isNonEmpty(s?.service)) return false;
      if (serviceType === "OTHERS") {
        if (!isNonEmpty(s?.service_code)) return false;
      } else if (!isNonEmpty(s?.trade)) {
        return false;
      }
      if (!isNonEmpty(s?.origin_code_read ?? s?.origin_code)) return false;
      if (!isNonEmpty(s?.destination_code_read ?? s?.destination_code))
        return false;
      if (!isNonEmpty(s?.shipment_terms_code_read ?? s?.shipment_terms_code))
        return false;

      const cargo = Array.isArray(s?.cargo_details) ? s.cargo_details : [];
      if (!cargo.length) return false;
      for (const c of cargo) {
        if (!isNonEmpty(c?.hazardous_cargo)) return false;
        if (String(c?.hazardous_cargo) === "Yes") {
          if (!isNonEmpty(c?.un_no)) return false;
          if (!isNonEmpty(c?.class)) return false;
          if (!isNonEmpty(c?.pkg_group)) return false;
        }

        if (serviceType === "AIR") {
          if (!isNonEmpty(c?.no_of_packages)) return false;
          if (!isNonEmpty(c?.gross_weight)) return false;
          if (!isNonEmpty(c?.volume_weight)) return false;
        } else if (serviceType === "LCL") {
          if (!isNonEmpty(c?.no_of_packages)) return false;
          if (!isNonEmpty(c?.gross_weight)) return false;
          if (!isNonEmpty(c?.volume)) return false;
        } else if (serviceType === "FCL") {
          if (!isNonEmpty(c?.container_type_code)) return false;
          if (!isNonEmpty(c?.no_of_containers)) return false;
          if (!isNonEmpty(c?.gross_weight)) return false;
        } else if (serviceType === "OTHERS") {
          const hasAirLike =
            isNonEmpty(c?.no_of_packages) &&
            isNonEmpty(c?.gross_weight) &&
            isNonEmpty(c?.volume_weight);
          const hasLclLike =
            isNonEmpty(c?.no_of_packages) &&
            isNonEmpty(c?.gross_weight) &&
            isNonEmpty(c?.volume);
          const hasFclLike =
            isNonEmpty(c?.container_type_code) &&
            isNonEmpty(c?.no_of_containers) &&
            isNonEmpty(c?.gross_weight);
          if (!hasAirLike && !hasLclLike && !hasFclLike) return false;
        }
      }
    }
    return true;
  }, [actualEnquiryData, isDirectQuoteFromList]);

  const handleInlineEnquirySync = useCallback(
    (next: Record<string, unknown>) => {
      const key = JSON.stringify(next);
      if (key === lastInlineSyncKeyRef.current) return;
      lastInlineSyncKeyRef.current = key;
      setInlineEnquiryData(next);
    },
    [],
  );

  // Get current service ID for API calls
  const currentServiceId = useMemo(() => {
    return selectedService?.id || null;
  }, [selectedService]);

  // const { origin_name, destination_name, container_type_name } =
  //   actualEnquiryData || {};
  // console.log("container_type_name---", container_type_name);

  // const containerTypeMap = {
  //   "20` High Cube Container": "20ft",
  //   "40` High Cube Container": "40ft",
  // };

  // const actualUnit = containerTypeMap[container_type_name];

  // const normalize = (str: string) =>
  //   str
  //     .replace(/['`]/g, "")
  //     .replace(/\s+/g, " ")
  //     .replace(/ft/i, "ft")
  //     .trim()
  //     .toLowerCase();

  // const rawType = enquiryData.container_type_name;
  // const cleaned = normalize(rawType);

  // const actualUnit = containerTypeMap[cleaned];
  // console.log("actualUnit:", actualUnit);

  const quotationForm = useForm({
    initialValues: {
      quote_currency_country_code: "",
      valid_upto: "",
      multi_carrier: "false",
      quote_type: "Standard",
      carrier_code: "",
      status: "QUOTE CREATED",
      remark: "",
    },
    validate: yupResolver(quotationFormSchema(isRemarkRequired)),
  });

  const dynamicForm = useForm<{ charges: ChargeType[] }>({
    initialValues: {
      charges: [
        {
          charge_name: "",
          charge_id: null,
          currency_country_code: defaultBranchCurrency || "",
          roe:
            defaultBranchCurrency && isBaseCurrency(defaultBranchCurrency)
              ? "1"
              : defaultBranchCurrency
                ? ""
                : "1",
          unit: "",
          no_of_units: "",
          sell_per_unit: "",
          min_sell: "",
          cost_per_unit: "",
          total_cost: "",
          total_sell: "",

          // min_cost: "",
        },
      ],
    },
    // Temporarily disable validation to debug charges display
    validate: yupResolver(dynamicFormSchema),
  });

  const syncChargeTotalsAtIndex = useCallback(
    (index: number, overrides?: Partial<ChargeType>) => {
      const base = dynamicForm.values.charges[index];
      if (!base) return;
      const { total_sell, total_cost } = computeChargeLineTotals({
        ...base,
        ...overrides,
      });
      if (
        base.total_sell === total_sell &&
        base.total_cost === total_cost
      ) {
        return;
      }
      dynamicForm.setFieldValue(`charges.${index}.total_sell`, total_sell);
      dynamicForm.setFieldValue(`charges.${index}.total_cost`, total_cost);
    },
    [dynamicForm],
  );

  const clearChargeRoeError = useCallback((index: number) => {
    setChargeRoeErrors((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const handleChargeCurrencyChange = useCallback(
    (index: number, currencyCode: string) => {
      const code = currencyCode.trim();
      dynamicForm.setFieldValue(
        `charges.${index}.currency_country_code`,
        code,
      );
      if (!code) {
        syncChargeTotalsAtIndex(index, { currency_country_code: "" });
        clearChargeRoeError(index);
        return;
      }
      if (isBaseCurrency(code)) {
        dynamicForm.setFieldValue(`charges.${index}.roe`, "1");
        syncChargeTotalsAtIndex(index, {
          currency_country_code: code,
          roe: "1",
        });
      } else {
        dynamicForm.setFieldValue(`charges.${index}.roe`, "");
        syncChargeTotalsAtIndex(index, {
          currency_country_code: code,
          roe: "",
        });
        void ensureRoeForCurrency(code.toUpperCase()).then((roe) => {
          if (roe == null) return;
          const current = dynamicForm.values.charges[index];
          if (
            String(current?.currency_country_code ?? "").trim().toUpperCase() !==
            code.toUpperCase()
          ) {
            return;
          }
          dynamicForm.setFieldValue(`charges.${index}.roe`, formatRoeAsString(roe));
          syncChargeTotalsAtIndex(index, { roe: formatRoeAsString(roe) });
        });
      }
      clearChargeRoeError(index);
    },
    [
      clearChargeRoeError,
      dynamicForm,
      ensureRoeForCurrency,
      isBaseCurrency,
      syncChargeTotalsAtIndex,
    ],
  );

  const handleChargeRoeChange = useCallback(
    (index: number, rawValue: string) => {
      const charge = dynamicForm.values.charges[index];
      const code = String(charge?.currency_country_code ?? "").trim();
      if (code && isBaseCurrency(code)) {
        dynamicForm.setFieldValue(`charges.${index}.roe`, "1");
        syncChargeTotalsAtIndex(index, { roe: "1" });
        clearChargeRoeError(index);
        return;
      }
      const sanitized = sanitizeRoeInput(rawValue);
      dynamicForm.setFieldValue(`charges.${index}.roe`, sanitized);
      syncChargeTotalsAtIndex(index, { roe: sanitized });
      const roeError = validateRoeField(code, parseBookingRoe(sanitized));
      setChargeRoeErrors((prev) => {
        if (roeError) return { ...prev, [index]: roeError };
        if (!prev[index]) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
    },
    [
      clearChargeRoeError,
      dynamicForm,
      isBaseCurrency,
      syncChargeTotalsAtIndex,
      validateRoeField,
    ],
  );

  const validateChargesRoe = useCallback((): boolean => {
    const chargeList = dynamicForm.values.charges || [];
    let toastMessage: string | null = null;
    const errors: Record<number, string> = {};

    chargeList.forEach((charge, index) => {
      const code = String(charge.currency_country_code ?? "").trim();
      if (!code) return;
      const roeError = validateRoeField(code, parseBookingRoe(charge.roe));
      if (!roeError) return;
      errors[index] = roeError;
      if (!toastMessage) {
        toastMessage =
          roeError === ROE_CANNOT_BE_ONE_FIELD
            ? ROE_CANNOT_BE_ONE_TOAST
            : roeError;
      }
    });

    if (Object.keys(errors).length === 0) return true;

    setChargeRoeErrors(errors);
    ToastNotification({
      type: "error",
      message: toastMessage ?? ROE_CANNOT_BE_ONE_TOAST,
    });
    return false;
  }, [
    dynamicForm.values.charges,
    validateRoeField,
    ROE_CANNOT_BE_ONE_FIELD,
    ROE_CANNOT_BE_ONE_TOAST,
  ]);

  const getDefaultNewChargeFields = useCallback(() => {
    const currencyCode = defaultBranchCurrency || "INR";
    return {
      currency_country_code: currencyCode,
      roe: isBaseCurrency(currencyCode) ? "1" : "",
    };
  }, [defaultBranchCurrency, isBaseCurrency]);

  const bindChargeAmountInput = useCallback(
    (
      index: number,
      field: "sell_per_unit" | "cost_per_unit" | "no_of_units" | "roe",
    ) => {
      if (field === "roe") {
        const formError = (dynamicForm.errors as any)?.charges?.[index]
          ?.roe as string | undefined;
        return {
          value: dynamicForm.values.charges[index]?.roe ?? "",
          error: formError || chargeRoeErrors[index],
          onChange: (event: ChangeEvent<HTMLInputElement>) => {
            handleChargeRoeChange(index, event.currentTarget.value);
          },
        };
      }

      const inputProps = dynamicForm.getInputProps(`charges.${index}.${field}`);
      return {
        ...inputProps,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          const raw = event.currentTarget.value;
          if (field === "no_of_units") {
            const previous = dynamicForm.values.charges[index]?.no_of_units;
            const coerced = coerceHouseCargoWeightInput(raw, previous);
            const value = coerced === null ? "" : String(coerced);
            dynamicForm.setFieldValue(`charges.${index}.no_of_units`, value);
            syncChargeTotalsAtIndex(index, { no_of_units: value });
            return;
          }
          inputProps.onChange?.(event);
          syncChargeTotalsAtIndex(index, { [field]: raw });
        },
      };
    },
    [
      chargeRoeErrors,
      dynamicForm,
      handleChargeRoeChange,
      syncChargeTotalsAtIndex,
    ],
  );

  /** Money fields: FormNumberInput value/onChange while form state stays string. */
  const bindChargeMoneyField = useCallback(
    (
      index: number,
      field: "sell_per_unit" | "cost_per_unit" | "min_sell",
    ) => {
      const current = dynamicForm.values.charges[index]?.[field];
      const formError = (dynamicForm.errors as any)?.charges?.[index]?.[
        field
      ] as string | undefined;
      return {
        value: moneyFormValueToNumber(
          current === null || current === undefined ? "" : String(current),
        ),
        error: formError,
        onChange: (value: string | number) => {
          const stored = currencyNumberInputToFormString(value);
          dynamicForm.setFieldValue(`charges.${index}.${field}`, stored);
          if (field === "sell_per_unit" || field === "cost_per_unit") {
            syncChargeTotalsAtIndex(index, { [field]: stored });
          }
        },
      };
    },
    [dynamicForm, syncChargeTotalsAtIndex],
  );

  const tariffOption = useForm({
    initialValues: {
      tariffVal: "",
    },
    validate: yupResolver(destinationOptionSchema),
  });

  // Helper function to load quotation data for a specific service
  const loadQuotationDataForService = useCallback(
    (quotationData: any, carrierData: any, currencyData: any) => {
      // Find carrier code by matching carrier name
      const matchedCarrier = carrierData.find(
        (carrier: any) => carrier.label === quotationData.carrier,
      );
      const carrierCode = matchedCarrier?.value || "";

      // Find currency code by matching currency name
      const data = currencyData as any[];
      const matchedCurrency = Array.isArray(data)
        ? data.find(
            (currency: any) =>
              currency.name === quotationData.quote_currency ||
              currency.code === quotationData.quote_currency,
          )
        : null;
      const currencyCode =
        matchedCurrency?.code || quotationData.quote_currency || "";

      // Set quotation form values
      quotationForm.setValues({
        quote_currency_country_code: currencyCode,
        valid_upto: quotationData.valid_upto || "",
        multi_carrier: quotationData.multi_carrier ? "true" : "false",
        quote_type: quotationData.quote_type || "Standard",
        carrier_code: carrierCode,
        status: "QUOTE CREATED", // Always set to default for consistency
        remark: resolveQuotationRemark(
          fetchedQuotationData || actualEnquiryData,
          quotationData.remark,
        ),
      });

      // Set dynamic form charges
      if (quotationData.charges && quotationData.charges.length > 0) {
        const formattedCharges = quotationData.charges.map((charge: any) => ({
          charge_name: charge.charge_name || "",
          charge_id: charge.charge_id ?? null,
          currency_country_code: charge.currency || "",
          roe: formatRoeAsString(charge.roe) || "1",
          unit: charge.unit || "",
          no_of_units: formatQuotationNoOfUnitsFromApi(charge.no_of_units),
          sell_per_unit: currencyApiValueToFormString(charge.sell_per_unit),
          min_sell: currencyApiValueToFormString(charge.min_sell),
          cost_per_unit: currencyApiValueToFormString(charge.cost_per_unit),
          total_cost: localApiValueToFormString(charge.total_cost),
          total_sell: localApiValueToFormString(charge.total_sell),
        }));

        dynamicForm.setValues({ charges: formattedCharges });
      } else {
        resetFormsToDefaults();
      }
    },
    [quotationForm, dynamicForm, fetchedQuotationData, actualEnquiryData],
  );

  // Helper function to reset forms to defaults
  const resetFormsToDefaults = useCallback(() => {
    quotationForm.setValues({
      quote_currency_country_code: "",
      valid_upto: "",
      multi_carrier: "false",
      quote_type: "Standard",
      carrier_code: "",
      status: "QUOTE CREATED",
      remark: "",
    });
    dynamicForm.setValues({
      charges: [
        {
          charge_name: "",
          charge_id: null,
          ...getDefaultNewChargeFields(),
          unit: "",
          no_of_units: "",
          sell_per_unit: "",
          min_sell: "",
          cost_per_unit: "",
          total_cost: "",
          total_sell: "",
        },
      ],
    });
  }, [quotationForm, dynamicForm, getDefaultNewChargeFields]);

  const snapshotServiceQuotationData = useCallback(() => {
    const currentService = services[selectedServiceIndex];
    const snapshot: {
      [serviceId: number]: {
        quotationForm: any;
        dynamicForm: any;
        hasQuotation: boolean;
      };
    } = { ...serviceQuotationData };

    if (currentService?.id) {
      snapshot[currentService.id] = {
        quotationForm: { ...quotationForm.values },
        dynamicForm: {
          charges: Array.isArray(dynamicForm.values.charges)
            ? dynamicForm.values.charges.map((charge: any) => ({ ...charge }))
            : [],
        },
        hasQuotation: true,
      };
    }

    return snapshot;
  }, [
    services,
    selectedServiceIndex,
    serviceQuotationData,
    quotationForm.values,
    dynamicForm.values,
  ]);

  // Helper function to navigate to enquiry-create with specific step
  const navigateToEnquiryStep = useCallback(
    (targetStep: number) => {
      // Allow navigation if standalone edit OR embedded edit mode without goToStep
      if (!isStandaloneEdit && !(isEmbeddedEditMode && !goToStep)) return;

      const serviceDataSnapshot = snapshotServiceQuotationData();
      const preserveFilters = location.state?.preserveFilters;
      const fromQuotation = !location.state?.fromEnquiry;
      const fromEnquiry = location.state?.fromEnquiry;

      const dataSource =
        actualEnquiryData || fetchedQuotationData || quotationData;
      const enquiryId =
        dataSource?.enquiry_id ||
        quotationData?.enquiry_id ||
        fetchedQuotationData?.enquiry_id;

      const enquiryIdForNav =
        quotationData?.enquiry_pk ||
        fetchedQuotationData?.enquiry_pk ||
        dataSource?.enquiry_pk ||
        quotationData?.enquiry_id ||
        fetchedQuotationData?.enquiry_id ||
        dataSource?.enquiry_id ||
        (actualEnquiryData?.id && !quotationData
          ? actualEnquiryData.id
          : null) ||
        (fetchedQuotationData?.id && !quotationData
          ? fetchedQuotationData.id
          : null);

      const serviceDetails = services.map((service) => ({
        id: service.id,
        service: service.service,
        service_type: (service as any).service_type || service.service,
        trade: service.trade,
        service_code: (service as any).service_code || "",
        service_name: (service as any).service_name || "",
        origin_code: service.origin_code_read || "",
        origin_code_read: service.origin_code_read || "",
        origin_name: service.origin_name || "",
        destination_code: service.destination_code_read || "",
        destination_code_read: service.destination_code_read || "",
        destination_name: service.destination_name || "",
        pickup: service.pickup,
        delivery: service.delivery,
        pickup_location: service.pickup_location || "",
        delivery_location: service.delivery_location || "",
        hazardous_cargo: service.hazardous_cargo || false,
        stackable:
          (service as any).stackable !== undefined
            ? (service as any).stackable
            : true,
        shipment_terms_code: service.shipment_terms_code_read || "",
        shipment_terms_code_read: service.shipment_terms_code_read || "",
        shipment_terms_name: service.shipment_terms_name || "",
        fcl_details: service.fcl_details,
        no_of_packages: service.no_of_packages,
        gross_weight: service.gross_weight,
        volume_weight: service.volume_weight,
        chargeable_weight: service.chargeable_weight,
        volume: service.volume,
        chargeable_volume: service.chargeable_volume,
      }));

      const enquiryDataToPass = {
        id: enquiryIdForNav,
        enquiry_id: enquiryId,
        actionType: "editQuotation",
        customer_code:
          dataSource?.customer_code ||
          quotationData?.customer_code ||
          fetchedQuotationData?.customer_code,
        customer_code_read:
          dataSource?.customer_code ||
          quotationData?.customer_code ||
          fetchedQuotationData?.customer_code,
        customer_name:
          dataSource?.customer_name ||
          quotationData?.customer_name ||
          fetchedQuotationData?.customer_name,
        customer_address:
          dataSource?.customer_address ||
          quotationData?.customer_address ||
          fetchedQuotationData?.customer_address,
        sales_person:
          dataSource?.sales_person ||
          quotationData?.sales_person ||
          fetchedQuotationData?.sales_person,
        sales_coordinator:
          dataSource?.sales_coordinator ||
          quotationData?.sales_coordinator ||
          fetchedQuotationData?.sales_coordinator ||
          "",
        customer_services:
          dataSource?.customer_services ||
          quotationData?.customer_services ||
          fetchedQuotationData?.customer_services ||
          "",
        enquiry_received_date:
          dataSource?.enquiry_received_date ||
          quotationData?.enquiry_received_date ||
          fetchedQuotationData?.enquiry_received_date,
        reference_no:
          dataSource?.reference_no ||
          quotationData?.reference_no ||
          fetchedQuotationData?.reference_no ||
          "",
        services: serviceDetails,
        preserveFilters,
        fromQuotation,
        fromEnquiry,
        quotation:
          dataSource?.quotation ||
          quotationData?.quotation ||
          fetchedQuotationData?.quotation,
        serviceQuotationState: serviceDataSnapshot,
        quotationId: quotationIdForEdit || undefined,
        // Pass target step to navigate to
        targetStep: targetStep,
      };

      navigate("/enquiry-create", {
        state: enquiryDataToPass,
      });
    },
    [
      isStandaloneEdit,
      isEmbeddedEditMode,
      goToStep,
      snapshotServiceQuotationData,
      location.state,
      actualEnquiryData,
      fetchedQuotationData,
      quotationData,
      services,
      quotationIdForEdit,
      navigate,
    ],
  );

  // Effect to ensure form isolation when switching services
  useEffect(() => {
    // Force form reset when service changes to prevent data bleeding
    if (selectedService) {
      const savedData = serviceQuotationData[selectedService.id];
      // In edit mode, skip reset when serviceQuotationData is still empty (initial load);
      // the init effect will populate from list/API. Otherwise we'd clear the form before it runs.
      if (
        !savedData &&
        isEditMode &&
        Object.keys(serviceQuotationData).length === 0
      ) {
        return;
      }
      if (!savedData) {
        // View mode from pipeline/dashboard loads via fetch + init; avoid clearing remark.
        if (isViewMode && quotationId) {
          return;
        }
        quotationForm.setValues({
          quote_currency_country_code: "",
          valid_upto: "",
          multi_carrier: "false",
          quote_type: "Standard",
          carrier_code: "",
          status: "QUOTE CREATED",
          remark: "",
        });
        dynamicForm.setValues({
          charges: [
            {
              charge_name: "",
              charge_id: null,
              ...getDefaultNewChargeFields(),
              unit: "",
              no_of_units: "",
              sell_per_unit: "",
              min_sell: "",
              cost_per_unit: "",
              total_cost: "",
              total_sell: "",
            },
          ],
        });
      }
    }
  }, [
    selectedServiceIndex,
    selectedService?.id,
    isEditMode,
    isViewMode,
    quotationId,
    serviceQuotationData,
  ]);

  // Fetch quotation details when quotationId is provided from URL
  useEffect(() => {
    const fetchQuotationDetails = async () => {
      if (quotationId) {
        setIsLoadingQuotationData(true);
        try {
          const response = (await getAPICall(
            `${URL.quotation}${quotationId}/`,
            API_HEADER,
          )) as any;
          console.log("Fetched quotation details:", response);

          // Map the response data to the form structure
          if (response.status && response.data) {
            const quotationData = response.data;

            // Set the fetched quotation data
            setFetchedQuotationData({
              id: quotationData.id,
              enquiry_id: quotationData.enquiry_id,
              customer_name: quotationData.customer_name,
              customer_code: quotationData.customer_code,
              sales_person: quotationData.sales_person,
              enquiry_received_date: quotationData.enquiry_received_date,
              status: quotationData.status,
              reject_remark: quotationData.reject_remark,
              origin_list: quotationData.origin_list,
              destination_list: quotationData.destination_list,
              quote_type_list: quotationData.quote_type_list,
              remark_list: quotationData.remark_list,
              valid_upto_list: quotationData.valid_upto_list,
              quotation: quotationData.quotation,
              created_by: quotationData.created_by,
              created_by_name: quotationData.created_by_name,
              created_at: quotationData.created_at,
              updated_by: quotationData.updated_by,
              updated_by_name: quotationData.updated_by_name,
              updated_at: quotationData.updated_at,
            });

            // Map quotation data to form fields if quotation array exists
            if (quotationData.quotation && quotationData.quotation.length > 0) {
              const quotation = quotationData.quotation[0]; // Use first quotation

              // Map static form fields
              const mappedQuotationForm = {
                quote_currency_country_code: quotation.quote_currency || "",
                valid_upto: quotation.valid_upto || "",
                multi_carrier: quotation.multi_carrier ? "true" : "false",
                quote_type: quotation.quote_type || "Standard",
                carrier_code: quotation.carrier_code || "",
                status: quotationData.status || "QUOTE CREATED",
                remark: resolveQuotationRemark(quotationData, quotation.remark),
              };

              // Map charges data
              const mappedCharges =
                quotation.charges?.map((charge: any) => ({
                  charge_name: charge.charge_name || "",
                  charge_id: charge.charge_id ?? null,
                  currency_country_code: charge.currency || "",
                  roe: formatRoeAsString(charge.roe) || "1",
                  unit: charge.unit || "",
                  no_of_units: formatQuotationNoOfUnitsFromApi(
                    charge.no_of_units,
                  ),
                  sell_per_unit: currencyApiValueToFormString(charge.sell_per_unit),
                  min_sell: currencyApiValueToFormString(charge.min_sell),
                  cost_per_unit: currencyApiValueToFormString(charge.cost_per_unit),
                  min_cost: currencyApiValueToFormString(charge.min_cost),
                  total_sell: localApiValueToFormString(charge.total_sell),
                  total_cost: localApiValueToFormString(charge.total_cost),
                  // preserve existing quotation charge id (fallbacks)
                  id:
                    charge.id ?? charge.charge_id ?? charge.quotation_charge_id,
                })) || [];

              // Set form values
              quotationForm.setValues(mappedQuotationForm);
              dynamicForm.setValues({ charges: mappedCharges });

              console.log("Mapped quotation form:", mappedQuotationForm);
              console.log("Mapped charges:", mappedCharges);
            }
          }
        } catch (error) {
          console.error("Error fetching quotation details:", error);
          ToastNotification({
            type: "error",
            message: "Failed to fetch quotation details",
          });
        } finally {
          setIsLoadingQuotationData(false);
        }
      }
    };

    fetchQuotationDetails();
  }, [quotationId]);

  // Handle quotation data passed from CallEntryNew
  useEffect(() => {
    console.log("useEffect triggered with location.state:", location.state);
    console.log("carrierData-----", carrierData);

    if (location.state?.quotationData) {
      const quotation = location.state.quotationData;
      console.log("Quotation data from CallEntryNew:", quotation);
      console.log("carrier code----", quotation.carrier_name);
      const matchedCarrier = carrierData.find(
        (carrier: any) =>
          carrier.label.trim().toLowerCase() ===
          quotation.carrier_name?.trim().toLowerCase(),
      );
      console.log("matchedCarrier----", matchedCarrier);

      const carrierCode = matchedCarrier?.value || "";
      console.log("qwdqwfwqf----", carrierCode);

      console.log("quoteCurrency----", quoteCurrency);
      const matchedQuote = quoteCurrency.find(
        (quote: any) =>
          quote.label.trim().toLowerCase() ===
          quotation.quote_currency?.trim().toLowerCase(),
      );
      console.log("matchedQuote---", matchedQuote);
      const quoteCurrency_code = matchedQuote?.value || "";

      // Pre-fill the quotation form with the quotation data
      quotationForm.setValues({
        quote_currency_country_code: quoteCurrency_code || "",
        valid_upto: quotation.valid_upto || "",
        multi_carrier: quotation.multi_carrier ? "true" : "false",
        quote_type: quotation.quote_type || "Standard",
        carrier_code: carrierCode || "",
        status: quotation.status || "QUOTE CREATED",
      });

      // Pre-fill the charges form if charges exist
      if (quotation.charges && quotation.charges.length > 0) {
        console.log("Charges found in quotation:", quotation.charges);
        const mappedCharges = quotation.charges.map((charge: any) => ({
          charge_name: charge.charge_name || "",
          charge_id: charge.charge_id ?? null,
          currency_country_code: charge.currency || "",
          roe: formatRoeAsString(charge.roe) || "1",
          unit: charge.unit || "",
          no_of_units: formatQuotationNoOfUnitsFromApi(charge.no_of_units),
          sell_per_unit: currencyApiValueToFormString(charge.sell_per_unit),
          min_sell: currencyApiValueToFormString(charge.min_sell),
          cost_per_unit: currencyApiValueToFormString(charge.cost_per_unit),
          ...computeChargeLineTotals({
            no_of_units: formatQuotationNoOfUnitsFromApi(charge.no_of_units),
            sell_per_unit: currencyApiValueToFormString(charge.sell_per_unit),
            cost_per_unit: currencyApiValueToFormString(charge.cost_per_unit),
            roe: parseRoeForPayload(charge.roe) ?? 1,
          }),
          // preserve existing quotation charge id (fallbacks)
          id: charge.id ?? charge.charge_id ?? charge.quotation_charge_id,
        }));

        console.log("Mapped charges from quotation data:", mappedCharges);

        // Force a re-render by using setTimeout to ensure form state is updated
        setTimeout(() => {
          dynamicForm.setValues({
            charges: mappedCharges,
          });
          console.log(
            "Dynamic form values after setting charges:",
            dynamicForm.values,
          );
        }, 0);
      } else {
        console.log("No charges found in quotation data");
      }
    } else {
      console.log("No quotation data in location.state");
    }
  }, [location.state]);

  // Monitor dynamicForm values for debugging
  // useEffect(() => {
  //   console.log("Dynamic form charges updated:", dynamicForm.values.charges);
  // }, [dynamicForm.values.charges]);

  useEffect(() => {
    console.log("useEffect triggered with chargesData:", chargesData);

    // Check if we have charges from location state (chatbot flow)
    if (
      location.state &&
      location.state.actionType === "create" &&
      location.state.charges
    ) {
      console.log(
        "Charges from location state detected, using those instead of chargesData",
      );
      return; // Skip this useEffect when we have charges from location state
    }

    if (chargesData.length === 0) {
      console.log("chargesData is empty, returning early");
      return;
    }

    const mappedCharges = chargesData.flatMap((enquiry) => {
      const isLCL = selectedService?.service === "LCL";

      return enquiry.charges.map((charge) => {
        const rate = charge.rate ?? 0;
        console.log("Individual charge---", charge);

        const quantity = charge.quantity ?? 1;
        console.log("quantity value---", quantity);

        const currencyCode = charge.currency ?? "";
        const roe = isBaseCurrency(currencyCode) ? 1 : "";

        const unit = charge.unit ?? "";
        // Calculate no_of_units based on service and unit (not from API response)
        const calculatedNoOfUnits =
          unit && selectedService
            ? calculateNoOfUnits(
                selectedService.service,
                unit,
                selectedService.id,
              )
            : "";

        const chargeRow = {
          charge_name: charge.charge_name ?? "",
          charge_id: (charge as any).charge_id ?? null,
          currency_country_code: charge.currency ?? "",
          roe: roe,
          unit: unit,
          no_of_units: calculatedNoOfUnits,
          sell_per_unit: isLCL ? currencyApiValueToFormString(rate) : "",
          cost_per_unit: isLCL ? "" : currencyApiValueToFormString(rate),
          min_sell: "",
          toBeDisabled: false,
        };
        return {
          ...chargeRow,
          ...computeChargeLineTotals(chargeRow),
        };
      });
    });

    console.log("Mapped charges for form:", mappedCharges);

    dynamicForm.setValues({
      charges:
        mappedCharges.length > 0
          ? mappedCharges
          : [
              {
                charge_name: "",
                charge_id: null,
                ...getDefaultNewChargeFields(),
                unit: "",
                no_of_units: "",
                sell_per_unit: "",
                min_sell: "",
                cost_per_unit: "",
                total_cost: "",
                total_sell: "",
              },
            ],
    });

    console.log(
      "dynamicForm.setValues called with charges:",
      mappedCharges.length > 0 ? mappedCharges : [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargesData, location.state, selectedService, isEditMode]);

  // Handle quotation data from chatbot
  // useEffect(() => {
  //   if (quotationDataFromChatbot) {
  //     console.log(
  //       "=== QuotationCreate received quotation data from chatbot ==="
  //     );
  //     console.log("Quotation data:", quotationDataFromChatbot);
  //     handleChatbotQuotationData(quotationDataFromChatbot);
  //   }
  // }, [quotationDataFromChatbot]);

  // Handle quotation data from destination page
  useEffect(() => {
    if (
      location.state &&
      location.state.actionType === "createQuote" &&
      location.state.fromDestination &&
      location.state.quotationData
    ) {
      console.log(
        "=== QuotationCreate received data from destination page ===",
      );
      console.log("Location state data:", location.state);

      const quotationData = location.state.quotationData;

      // Set carrier code
      quotationForm.setFieldValue(
        "carrier_code",
        quotationData.carrier_code || "",
      );
      quotationForm.setFieldValue("quote_type", "Standard");

      console.log("Charges from destination:", quotationData.charges);
      console.log(
        "No of containers from destination:",
        quotationData.no_of_containers,
      );

      if (quotationData.charges && Array.isArray(quotationData.charges)) {
        // Map charges from destination API response format to form format
        const mappedCharges = quotationData.charges.map((charge: any) => {
          const noOfContainers =
            quotationData.no_of_containers?.toString() || "1";
          const rate = currencyApiValueToFormString(charge.rate ?? 0) || "0";

          const mappedCharge = {
            charge_name: charge.charge_name || "",
            charge_id: charge.charge_id ?? null,
            currency_country_code: charge.currency_code || "INR",
            roe: 1,
            unit: charge.unit || "",
            no_of_units: noOfContainers,
            sell_per_unit: "", // Leave empty for user to enter manually
            min_sell: "",
            cost_per_unit: rate, // Set cost per unit from API rate
            total_cost: "",
            total_sell: "",
            toBeDisabled: false,
          };

          console.log("Mapping individual charge:", {
            chargeName: charge.charge_name,
            currencyName: charge.currency_name,
            unit: charge.unit,
            rate: charge.rate,
            noOfContainers: quotationData.no_of_containers,
            mappedCharge: mappedCharge,
          });

          return mappedCharge;
        });

        console.log("Mapped charges from destination (final):", mappedCharges);
        console.log("Setting charges to dynamicForm...");

        // Force a re-render by using setTimeout to ensure form state is updated
        setTimeout(() => {
          dynamicForm.setValues({ charges: mappedCharges });
          console.log("✅ Charges successfully set to dynamicForm");
          console.log(
            "Current dynamicForm.values.charges:",
            dynamicForm.values.charges,
          );

          // Log each charge to verify data
          mappedCharges.forEach((charge: ChargeType, index: number) => {
            console.log(`Charge ${index}:`, {
              charge_name: charge.charge_name,
              currency: charge.currency_country_code,
              no_of_units: charge.no_of_units,
              cost_per_unit: charge.cost_per_unit,
              sell_per_unit: charge.sell_per_unit,
            });
          });
        }, 200);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Debug useEffect to monitor charges changes from destination flow
  useEffect(() => {
    if (
      location.state?.fromDestination &&
      location.state?.actionType === "createQuote"
    ) {
      console.log("🔍 Destination flow - Current charges state:", {
        chargesCount: dynamicForm.values.charges.length,
        charges: dynamicForm.values.charges,
      });
    }
  }, [dynamicForm.values.charges, location.state]);

  // Handle quotation data from location state (when chatbot navigates)
  useEffect(() => {
    if (location.state && location.state.actionType === "create") {
      console.log(
        "=== QuotationCreate received quotation data from location state ===",
      );
      console.log("Location state data:", location.state);

      // Use location.state directly since it contains the transformed quotation data
      const quotationData = location.state;

      if (!quotationData) {
        console.log("No quotation data provided");
        return;
      }

      // Set form values from quotation data
      quotationForm.setFieldValue(
        "carrier_code",
        quotationData.carrier_code || "",
      );
      quotationForm.setFieldValue(
        "quote_type",
        quotationData.quote_type || "Standard",
      );

      console.log("Charges from quotation data:", quotationData.charges);

      if (quotationData.charges && Array.isArray(quotationData.charges)) {
        // Get service type from quotation data
        const serviceType = quotationData.service || "FCL";
        console.log(
          "Service type for charges mapping in first useEffect:",
          serviceType,
        );

        // Map charges from quotation data format to the format expected by the form
        const mappedCharges = quotationData.charges.map((charge: any) => {
          const rate = charge.rate || 0;
          const isLCL = serviceType === "LCL";

          return {
            charge_name: charge.charge_name || "",
            currency: charge.currency_country_code || charge.currency || "INR",
            unit: charge.unit || "",
            quantity:
              charge.no_of_units?.toString() ||
              charge.quantity?.toString() ||
              "",
            rate: isLCL
              ? charge.sell_per_unit?.toString() || rate.toString()
              : charge.cost_per_unit?.toString() || rate.toString(),
          };
        });

        console.log("Mapped charges:", mappedCharges);

        // Create the formatted charges data structure similar to tariffSubmit
        const formattedChargesData: ChargesDataItem = {
          enquiry_id: quotationData.enquiry_id,
          charges: mappedCharges,
        };

        console.log("Formatted charges data:", formattedChargesData);

        // Set the charges data which will trigger the useEffect to populate the form
        setCharges([formattedChargesData]);
        console.log("setCharges called with:", [formattedChargesData]);
      } else {
        console.log(
          "No charges found in quotation data or charges is not an array",
        );
      }

      // Call handleChatbotQuotationData with the location.state data for form fields
      handleChatbotQuotationData(location.state);
    }
  }, [location.state]);

  // Handle charges from location state (chatbot flow) - populate dynamic form directly
  useEffect(() => {
    if (
      location.state &&
      location.state.actionType === "create" &&
      location.state.charges
    ) {
      console.log(
        "=== Populating dynamic form with charges from location state ===",
      );
      console.log("state---", location.state);
      console.log("Charges from location state:", location.state.charges);

      // Get service type from location state
      const serviceType = location.state.service;
      console.log("Service type for charges mapping:", serviceType);

      // The charges are already in the correct format from the transformation
      // Directly populate the dynamic form with the charges
      const chargesForForm = location.state.charges.map((charge: any) => {
        console.log("Individual charges---", charge);

        const rate = charge.rate || 0;
        console.log("rate---", rate);
        console.log("charge rate---", charge.rate);

        // Based on service type, set rate in appropriate field
        const isLCL = serviceType === "LCL";
        console.log("isLCL---", isLCL);

        return {
          charge_name: charge.charge_name || "",
          charge_id: charge.charge_id ?? null,
          currency_country_code: charge.currency_country_code || "INR",
          roe: formatRoeAsString(charge.roe) || "1",
          unit: charge.unit || "",
          no_of_units:
            charge.no_of_units != null
              ? formatQuotationNoOfUnitsFromApi(charge.no_of_units)
              : "1",
          // sell_per_unit: isLCL ? rate.toString() : charge.sell_per_unit || "0",
          sell_per_unit: isLCL
            ? currencyApiValueToFormString(charge.sell_per_unit)
            : "",
          min_sell: currencyApiValueToFormString(charge.min_sell),
          // cost_per_unit: isLCL ? charge.cost_per_unit || "0" : rate.toString(),
          cost_per_unit: isLCL
            ? ""
            : currencyApiValueToFormString(charge.sell_per_unit),
          total_cost: localApiValueToFormString(
            charge.total_cost != null ? charge.total_cost : 0,
          ),
          total_sell: localApiValueToFormString(
            charge.total_sell != null ? charge.total_sell : 0,
          ),
        };
      });

      console.log("Charges for form:", chargesForForm);

      // Set the charges directly in the dynamic form
      dynamicForm.setFieldValue("charges", chargesForForm);

      console.log("Dynamic form charges set:", dynamicForm.values.charges);
    }
  }, [location.state]);

  const charges = dynamicForm.values.charges || [];
  console.log("charges value----", charges);

  const chargeCurrenciesKey = charges
    .map((c) => String(c.currency_country_code ?? "").trim())
    .join("|");

  useEffect(() => {
    if (!defaultBranchCurrency) return;
    let changed = false;
    const updated = charges.map((charge) => {
      const code = String(charge.currency_country_code ?? "").trim();
      if (code && isBaseCurrency(code) && parseBookingRoe(charge.roe) !== 1) {
        changed = true;
        return {
          ...charge,
          roe: "1",
          ...computeChargeLineTotals({ ...charge, roe: "1" }),
        };
      }
      return charge;
    });
    if (changed) dynamicForm.setValues({ charges: updated });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrenciesKey, defaultBranchCurrency]);

  useEffect(() => {
    charges.forEach((charge, index) => {
      const code = String(charge.currency_country_code ?? "")
        .trim()
        .toUpperCase();
      if (!code) return;
      const roeEmpty =
        charge.roe === "" ||
        charge.roe === null ||
        charge.roe === undefined;
      if (!roeEmpty) return;
      if (isBaseCurrency(code)) return;
      void ensureRoeForCurrency(code).then((roe) => {
        if (roe == null) return;
        const current = dynamicForm.values.charges[index];
        if (!current) return;
        const stillEmpty =
          current.roe === "" ||
          current.roe === null ||
          current.roe === undefined;
        if (
          String(current.currency_country_code ?? "").trim().toUpperCase() !==
          code
        ) {
          return;
        }
        if (!stillEmpty) return;
        dynamicForm.setFieldValue(`charges.${index}.roe`, formatRoeAsString(roe));
        syncChargeTotalsAtIndex(index, { roe: formatRoeAsString(roe) });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrenciesKey]);

  const netCost = charges.reduce((sum: number, item: any) => {
    const cost = parseFloat(item.total_cost || "0");
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);

  const netSell = charges.reduce((sum: number, item: any) => {
    const sell = parseFloat(item.total_sell || "0");
    return sum + (isNaN(sell) ? 0 : sell);
  }, 0);
  const profit = netSell - netCost;

  const fetchCurrencyMaster = async () => {
    try {
      const response = await getAPICall(`${URL.currencyMaster}`, API_HEADER);
      return response;
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchCarrier = async () => {
    try {
      const response = await getAPICall(`${URL.carrier}`, API_HEADER);
      // console.log("fetchCarrier response------", response);
      return response;

      // const carrierOptions = response.map((item) => ({
      //   value: String(item.carrier_code),
      //   label: item.carrier_name,
      // }));
      // setCarrier(carrierOptions);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchOtherServices = async () => {
    const response = await getAPICall(
      `${URL.serviceMaster}?filter=other_services`,
      API_HEADER,
    );
    return response;
  };

  const handleChatbotQuotationData = (quotationData: any) => {
    if (!quotationData) {
      console.log("No quotation data provided");
      return;
    }

    // Set form values from chatbot data
    quotationForm.setFieldValue(
      "carrier_code",
      quotationData.carrier_code || "",
    );
    quotationForm.setFieldValue(
      "quote_type",
      quotationData.quote_type || "Standard",
    );
    quotationForm.setFieldValue(
      "quote_currency_country_code",
      quotationData.quote_currency_country_code || "INR",
    );
    quotationForm.setFieldValue(
      "valid_upto",
      quotationData.valid_upto ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
    );
    quotationForm.setFieldValue(
      "multi_carrier",
      quotationData.multi_carrier ? "true" : "false",
    );
    quotationForm.setFieldValue(
      "status",
      quotationData.status || "QUOTE CREATED",
    );

    console.log("Charges from quotation data:", quotationData.charges);

    // Note: Charges are handled separately in another useEffect to avoid conflicts
    // This function only handles form field values, not charges
  };

  // Function to validate a specific service's data
  const validateServiceData = (serviceIndex: number) => {
    const service = services[serviceIndex];
    const serviceData = serviceQuotationData[service.id];

    if (!serviceData) {
      return false; // No data means unfilled
    }

    const quotationFormData = serviceData.quotationForm;
    const dynamicFormData = serviceData.dynamicForm;

    // Check mandatory quotation form fields
    const requiredQuotationFields = [
      "quote_currency_country_code",
      "valid_upto",
      "multi_carrier",
      "quote_type",
      "status",
    ];

    for (const field of requiredQuotationFields) {
      if (!quotationFormData[field] || quotationFormData[field] === "") {
        return false;
      }
    }

    // Check if charges exist and are valid
    const charges = dynamicFormData.charges || [];
    if (charges.length === 0) {
      return false;
    }

    // Check each charge for required fields
    for (const charge of charges) {
      const requiredChargeFields = [
        "charge_name",
        "currency_country_code",
        "unit",
        "no_of_units",
        "sell_per_unit",
        "cost_per_unit",
      ];

      for (const field of requiredChargeFields) {
        if (!charge[field] || charge[field] === "") {
          return false;
        }
      }
    }

    return true;
  };

  // Function to check for unfilled services
  const checkForUnfilledServices = () => {
    const unfilled: number[] = [];

    console.log("Checking unfilled services. Total services:", services.length);
    console.log("Current service index:", selectedServiceIndex);
    console.log("Service quotation data:", serviceQuotationData);

    services.forEach((service, index) => {
      const serviceData = serviceQuotationData[service.id];
      const isCurrentService = index === selectedServiceIndex;

      console.log(`Service ${index} (ID: ${service.id}):`, {
        isCurrentService,
        hasServiceData: !!serviceData,
        hasQuotation: serviceData?.hasQuotation,
      });

      if (isCurrentService) {
        // For current service, check if form is valid
        const quotationResult = quotationForm.validate();
        const dynamicResult = dynamicForm.validate();

        console.log(`Current service ${index} validation:`, {
          quotationErrors: quotationResult.hasErrors,
          dynamicErrors: dynamicResult.hasErrors,
        });

        if (quotationResult.hasErrors || dynamicResult.hasErrors) {
          unfilled.push(index);
        }
      } else {
        // For other services, validate their data
        const isValid = validateServiceData(index);
        console.log(`Service ${index} validation result:`, isValid);
        if (!isValid) {
          unfilled.push(index);
        }
      }
    });

    console.log("Unfilled services found:", unfilled);
    return unfilled;
  };

  const quotationSubmit = async () => {
    console.log("quotationSubmit called");

    // Check if this is from destination or direct quotation-list create flow
    if (isDirectQuoteCreateFlow) {
      setIsSubmittingQuotation(true);
      console.log("Validating mandatory fields for direct quote flow...");
      console.log("Current enquiryData:", actualEnquiryData);

      if (location.state?.fromQuotationList && validateEnquiryRef.current) {
        const enquiryFormsValid = validateEnquiryRef.current();
        if (!enquiryFormsValid) {
          setIsSubmittingQuotation(false);
          ToastNotification({
            type: "warning",
            message: "Please fill mandatory enquiry details",
          });
          enquirySectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
          return;
        }
      }

      // Check mandatory enquiry details from the merged enquiry data
      const hasCustomer = actualEnquiryData?.customer_code;
      const hasSalesPerson = actualEnquiryData?.sales_person;
      const hasEnquiryDate = actualEnquiryData?.enquiry_received_date;

      console.log("Validation check:", {
        hasCustomer,
        hasSalesPerson,
        hasEnquiryDate,
      });

      if (!hasCustomer || !hasSalesPerson || !hasEnquiryDate) {
        setIsSubmittingQuotation(false);
        ToastNotification({
          type: "warning",
          message: "Please fill mandatory enquiry details",
        });
        if (location.state?.fromQuotationList) {
          enquirySectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        } else if (goToStep) {
          goToStep(0);
        }
        return;
      }

      // Check mandatory quotation fields
      const mandatoryQuotationFields = {
        quote_currency_country_code:
          quotationForm.values.quote_currency_country_code,
        valid_upto: quotationForm.values.valid_upto,
        quote_type: quotationForm.values.quote_type,
        status: quotationForm.values.status,
      };

      const missingQuotationFields = Object.entries(mandatoryQuotationFields)
        .filter(([, value]) => !value)
        .map(([key]) => {
          // Map field names to user-friendly labels
          const fieldLabels: { [key: string]: string } = {
            quote_currency_country_code: "Quote Currency",
            valid_upto: "Quotation Date",
            quote_type: "Quote Type",
            status: "Status",
          };
          return fieldLabels[key] || key.replace(/_/g, " ");
        });

      if (missingQuotationFields.length > 0) {
        setIsSubmittingQuotation(false);
        console.log("Missing quotation fields:", missingQuotationFields);
        ToastNotification({
          type: "error",
          message: `Please fill mandatory quotation fields: ${missingQuotationFields.join(", ")}`,
        });
        // Stay on quotation page - don't navigate
        return;
      }

      // Check mandatory charge fields
      const charges = dynamicForm.values.charges;
      if (charges.length === 0) {
        setIsSubmittingQuotation(false);
        ToastNotification({
          type: "warning",
          message: "At least one charge is required",
        });
        return;
      }

      // Validate each charge has mandatory fields
      for (let i = 0; i < charges.length; i++) {
        const charge = charges[i];
        const missingFields = [];

        if (!charge.charge_name) missingFields.push("Charge Name");
        if (!charge.currency_country_code) missingFields.push("Currency");
        if (!charge.unit) missingFields.push("Unit");
        if (!charge.sell_per_unit) missingFields.push("Sell Per Unit");

        if (missingFields.length > 0) {
          setIsSubmittingQuotation(false);
          console.log(`Charge ${i + 1} missing fields:`, missingFields);
          ToastNotification({
            type: "error",
            message: `Charge ${i + 1}: Please fill ${missingFields.join(", ")}`,
          });
          // Stay on quotation page - don't navigate
          return;
        }
      }

      console.log("✅ All mandatory fields validated for destination flow");

      // First, create the enquiry if it doesn't exist
      if (!actualEnquiryData?.enquiry_id && !actualEnquiryData?.id) {
        console.log("Creating enquiry first for direct quote flow...");

        try {
          // Get services from enquiry data
          const services =
            actualEnquiryData?.services || location.state?.services || [];

          console.log("Services data before mapping:", services);

          // Prepare enquiry payload matching EnquiryCreate.getEnquiryPayload
          const enquiryPayload = {
            ...buildCustomerCreatePayloadFields({
              selection: {
                selectionType: actualEnquiryData?.temp_code ? "temp" : "master",
                customerName: actualEnquiryData?.customer_name || "",
                tempCode: actualEnquiryData?.temp_code || null,
              },
              customerFieldValue: actualEnquiryData?.customer_code || "",
              fieldKey: "customer_code",
            }),
            enquiry_received_date: actualEnquiryData?.enquiry_received_date,
            sales_person: actualEnquiryData?.sales_person,
            sales_coordinator: actualEnquiryData?.sales_coordinator || null,
            customer_services: actualEnquiryData?.customer_services || null,
            services: services.map((serviceDetail: any) =>
              buildEnquiryServicePayload(serviceDetail, otherServicesData),
            ),
          };

          console.log(
            "Complete enquiry payload:",
            JSON.stringify(enquiryPayload, null, 2),
          );

          // Create enquiry
          const enquiryResponse = (await postAPICall(
            URL.enquiry,
            enquiryPayload,
            API_HEADER,
          )) as EnquiryCreateApiResponse;

          console.log("Enquiry created successfully:", enquiryResponse);

          const createdEnquiry = normalizeEnquiryCreateResponse(enquiryResponse);

          if (!createdEnquiry?.enquiry_id) {
            setIsSubmittingQuotation(false);
            ToastNotification({
              type: "error",
              message: "Failed to create enquiry. Please try again.",
            });
            return;
          }

          // Invalidate all enquiry-related queries to refresh data
          await queryClient.invalidateQueries({ queryKey: ["enquiries"] });
          await queryClient.invalidateQueries({
            queryKey: ["filteredEnquiries"],
          });
          await queryClient.invalidateQueries({ queryKey: ["enquirySearch"] });
          await queryClient.invalidateQueries({ queryKey: ["enquiryPreview"] });
          await queryClient.invalidateQueries({
            queryKey: ["filteredPreviewData"],
          });
          await queryClient.invalidateQueries({
            queryKey: ["initialPreviewData"],
          });
          await queryClient.invalidateQueries({ queryKey: ["previewSearch"] });

          const enquiryUpdate = {
            enquiry_id: createdEnquiry.enquiry_id,
            id: createdEnquiry.id,
            services: createdEnquiry.services ?? actualEnquiryData?.services,
          };

          Object.assign(actualEnquiryData as object, enquiryUpdate);
          actualEnquiryDataRef.current = {
            ...actualEnquiryDataRef.current,
            ...enquiryUpdate,
          };
          setInlineEnquiryData((prev) => ({
            ...(prev ?? {}),
            ...enquiryUpdate,
          }));

          const oldServices =
            (actualEnquiryData?.services as Array<{ id: number }> | undefined) ||
            [];
          const newServices = createdEnquiry.services || [];
          if (newServices.length > 0) {
            setServiceQuotationData((prev) => {
              if (!Object.keys(prev).length) return prev;

              const remapped: typeof prev = {};
              Object.entries(prev).forEach(([key, value]) => {
                const numericKey = Number(key);
                if (newServices.some((service) => service.id === numericKey)) {
                  remapped[numericKey] = value;
                  return;
                }

                const orderIndex = oldServices.findIndex(
                  (service) => service.id === numericKey,
                );
                const index =
                  orderIndex >= 0
                    ? orderIndex
                    : numericKey >= 1 && numericKey <= newServices.length
                      ? numericKey - 1
                      : -1;

                if (index >= 0 && newServices[index]) {
                  remapped[newServices[index].id] = value;
                } else {
                  remapped[numericKey] = value;
                }
              });
              return remapped;
            });
          }

          console.log("Updated enquiry data with ID:", {
            ...actualEnquiryData,
            ...enquiryUpdate,
          });

          // Now proceed with quotation submission using the new enquiry_id
          await submitQuotation();
          return;
        } catch (error: any) {
          setIsSubmittingQuotation(false);
          console.error("Error creating enquiry:", error);
          ToastNotification({
            type: "error",
            message: `Error creating enquiry: ${error?.message || "Unknown error"}`,
          });
          return;
        }
      } else {
        // Enquiry already exists, just submit quotation
        console.log("Enquiry already exists, submitting quotation...");
        await submitQuotation();
        return;
      }
    }

    // Normal flow validation (existing logic)
    // Custom validation for carrier_code when service is LCL
    if (selectedService?.service === "LCL") {
      // For LCL service, carrier_code is not required, so we'll skip validation
      quotationForm.setFieldError("carrier_code", "");
    }

    const quotationResult = quotationForm.validate();
    const dynamicResult = dynamicForm.validate();
    console.log("quotationResult----", quotationResult);
    console.log("dynamicResult----", dynamicResult);

    if (!quotationResult.hasErrors && !dynamicResult.hasErrors) {
      if (!validateChargesRoe()) {
        setIsSubmittingQuotation(false);
        return;
      }
      // Check for unfilled services before submitting
      const unfilledServicesList = checkForUnfilledServices();

      if (unfilledServicesList.length > 0) {
        // Show popup for unfilled services
        setIsSubmittingQuotation(false);
        setUnfilledServices(unfilledServicesList);
        setUnfilledServicesModalOpened(true);
        return;
      }

      // Proceed with submission if no unfilled services
      setIsSubmittingQuotation(true);
      await submitQuotation();
    }
  };

  const handleProceedToUnfilledService = () => {
    setUnfilledServicesModalOpened(false);
    // Navigate to the first unfilled service
    if (unfilledServices.length > 0) {
      console.log("Navigating to unfilled service index:", unfilledServices[0]);
      console.log("Unfilled services:", unfilledServices);
      handleServiceSelect(unfilledServices[0]);
    }
  };

  const handleSubmitWithIncompleteData = async () => {
    setUnfilledServicesModalOpened(false);
    if (!validateChargesRoe()) return;
    setIsSubmittingQuotation(true);
    await submitQuotation();
  };

  const handleCreateBooking = () => {
    if (!selectedService) {
      ToastNotification({
        type: "warning",
        message: "Please select a service first",
      });
      return;
    }

    // Get the quotation data for the selected service
    const quotationForService = actualEnquiryData?.quotation?.find(
      (q: any) => q.service_id === selectedService.id,
    );

    if (!quotationForService) {
      ToastNotification({
        type: "warning",
        message: "No quotation data found for selected service",
      });
      return;
    }

    // Merge quotation codes into service details so booking form can prefill origin, destination, shipment terms
    const serviceDetails = {
      ...selectedService,
      origin_code:
        quotationForService.origin_code ?? selectedService.origin_code_read,
      origin_code_read:
        quotationForService.origin_code ?? selectedService.origin_code_read,
      origin_name: quotationForService.origin ?? selectedService.origin_name,
      destination_code:
        quotationForService.destination_code ??
        selectedService.destination_code_read,
      destination_code_read:
        quotationForService.destination_code ??
        selectedService.destination_code_read,
      destination_name:
        quotationForService.destination ?? selectedService.destination_name,
      shipment_terms_code:
        quotationForService.shipment_terms_code ??
        selectedService.shipment_terms_code_read,
      shipment_terms_code_read:
        quotationForService.shipment_terms_code ??
        selectedService.shipment_terms_code_read,
      shipment_terms_name:
        quotationForService.shipment_terms ??
        quotationForService.shipment_terms_name ??
        selectedService.shipment_terms_name,
    };

    const bookingData = {
      enquiryData: {
        enquiry_id: actualEnquiryData.enquiry_id,
        customer_name: actualEnquiryData.customer_name,
        customer_address: actualEnquiryData.customer_address || "",
        customer_address_id:
          actualEnquiryData.customer_address_id != null
            ? Number(actualEnquiryData.customer_address_id)
            : undefined,
        sales_person: actualEnquiryData.sales_person,
        enquiry_received_date: actualEnquiryData.enquiry_received_date,
        customer_code: actualEnquiryData.customer_code || "",
      },
      quotationData: quotationForService,
      serviceDetails,
      // Quotation primary key (id) for filter-gained API - row id from filter_quotations list (e.g. 163), NOT quotation_service_id (197)
      quotation_primary_id: actualEnquiryData?.id,
    };
    console.log("bookingData---", bookingData);

    const trade = quotationForService.trade || selectedService.trade;
    const serviceType =
      quotationForService.service_type || selectedService.service;
    const serviceCode =
      quotationForService.service_code ||
      selectedService.service_code ||
      "";

    const bookingPath = getBookingCreatePath(serviceType, trade, {
      serviceCode,
      otherServicesData,
    });

    if (bookingPath) {
      navigate(bookingPath, { state: { bookingData } });
      return;
    }

    if (
      serviceType === "OTHERS" &&
      serviceCode &&
      trade !== "Export" &&
      trade !== "Import"
    ) {
      ToastNotification({ type: "error", message: "Invalid trade type" });
      return;
    }

    ToastNotification({
      type: "error",
      message:
        "Create booking is only supported for AIR, FCL, LCL and inland OTHERS services",
    });
  };

  const submitQuotation = async () => {
    // Calculate totals from charges (clamped like InvoiceCreate money payload)
    const charges = dynamicForm.values.charges || [];
    const netCost =
      clampLocalAmount(
        charges.reduce((sum, item) => sum + parseLocalMoneyForPayload(item.total_cost), 0),
      ) ?? 0;

    const netSell =
      clampLocalAmount(
        charges.reduce((sum, item) => sum + parseLocalMoneyForPayload(item.total_sell), 0),
      ) ?? 0;
    const profit = clampLocalAmount(netSell - netCost) ?? 0;

    // Transform charges for CURRENT service to API format
    const transformedCharges = charges.map((charge: any) => {
      const base: any = {
        charge_name: charge.charge_name,
        charge_id:
          charge.charge_id !== undefined && charge.charge_id !== null
            ? Number(charge.charge_id)
            : null,
        currency_country_code: charge.currency_country_code,
        roe: parseRoeForPayload(charge.roe) ?? 1,
        unit: charge.unit,
        no_of_units: parseNoOfUnitForPayload(charge.no_of_units) ?? 0,
        sell_per_unit: parseCurrencyMoneyForPayload(charge.sell_per_unit),
        min_sell: parseCurrencyMoneyForPayload(charge.min_sell),
        cost_per_unit: parseCurrencyMoneyForPayload(charge.cost_per_unit),
        total_sell: parseLocalMoneyForPayload(charge.total_sell),
        total_cost: parseLocalMoneyForPayload(charge.total_cost),
        // min_cost: parseCurrencyMoneyForPayload(charge.min_cost),
      };
      // Include the quotation charge line id only for existing charges
      if (charge.id !== undefined && charge.id !== null) base.id = charge.id;
      return base;
    });

    // Get the correct service_id - use from enquiry response if available, otherwise current
    let serviceId = currentServiceId;

    // For destination or direct quotation-list create flow, get service_id from enquiry response
    if (isDirectQuoteCreateFlow) {
      const enquiryServices = actualEnquiryData?.services || [];
      if (enquiryServices.length > 0 && currentServiceId != null) {
        serviceId = resolveEnquiryServiceId(currentServiceId, enquiryServices);
        console.log("Using service_id from enquiry response:", serviceId);
      }
    }

    // Get notes and conditions - use fetched data if modal hasn't been opened
    let notesToUse = notes;
    let conditionsToUse = conditions;

    // If notes/conditions are empty and we have fetched data, use that
    if (
      (notes.length === 0 || (notes.length === 1 && notes[0] === "")) &&
      currentServiceId &&
      fetchedNotesConditions[currentServiceId]
    ) {
      notesToUse = fetchedNotesConditions[currentServiceId].notes;
    }
    if (
      (conditions.length === 0 ||
        (conditions.length === 1 && conditions[0] === "")) &&
      currentServiceId &&
      fetchedNotesConditions[currentServiceId]
    ) {
      conditionsToUse = fetchedNotesConditions[currentServiceId].conditions;
    }

    // Filter out empty notes and conditions
    const filteredNotes = notesToUse.filter((note) => note.trim() !== "");
    const filteredConditions = conditionsToUse.filter(
      (condition) => condition.trim() !== "",
    );

    // Create service data for current service
    // ICD is now retrieved from enquiry service details, not from quotation form
    const serviceData = {
      service_id: serviceId,
      carrier_code: quotationForm.values.carrier_code,
      icd: selectedService?.icd || "", // Get ICD from enquiry service details
      remark: quotationForm.values.remark,
      valid_upto: quotationForm.values.valid_upto,
      multi_carrier: quotationForm.values.multi_carrier === "true",
      quote_type: quotationForm.values.quote_type,
      total_cost: netCost,
      total_sell: netSell,
      profit: profit,
      quote_currency_country_code:
        quotationForm.values.quote_currency_country_code,
      charges: transformedCharges,
      notes: filteredNotes,
      conditions: filteredConditions,
    };

    // Collect all service data for the quotation
    const allServiceData = { ...serviceQuotationData };
    if (currentServiceId) {
      allServiceData[currentServiceId] = {
        quotationForm: { ...quotationForm.values },
        dynamicForm: { ...dynamicForm.values },
        hasQuotation: true,
      };
    }

    // Transform all services to new format
    const quotationServicesData = Object.entries(allServiceData).map(
      ([originalServiceId, data]) => {
        const serviceCharges = data.dynamicForm.charges || [];
        const serviceNetCost =
          clampLocalAmount(
            serviceCharges.reduce(
              (sum: number, item: any) =>
                sum + parseLocalMoneyForPayload(item.total_cost),
              0,
            ),
          ) ?? 0;
        const serviceNetSell =
          clampLocalAmount(
            serviceCharges.reduce(
              (sum: number, item: any) =>
                sum + parseLocalMoneyForPayload(item.total_sell),
              0,
            ),
          ) ?? 0;
        const serviceProfit = clampLocalAmount(serviceNetSell - serviceNetCost) ?? 0;

        // For destination or direct quotation-list create flow, use service_id from enquiry response
        let finalServiceId = parseInt(originalServiceId);
        if (isDirectQuoteCreateFlow) {
          const enquiryServices = actualEnquiryData?.services || [];
          if (enquiryServices.length > 0) {
            finalServiceId = resolveEnquiryServiceId(
              originalServiceId,
              enquiryServices,
            );
          }
        }

        // Get notes and conditions for this service
        let serviceNotes: string[] = [];
        let serviceConditions: string[] = [];

        if (parseInt(originalServiceId) === currentServiceId) {
          // For current service, use filtered notes/conditions
          serviceNotes = filteredNotes;
          serviceConditions = filteredConditions;
        } else {
          // For other services, use fetched data if available
          const fetchedData =
            fetchedNotesConditions[parseInt(originalServiceId)];
          if (fetchedData) {
            serviceNotes = fetchedData.notes.filter(
              (note) => note.trim() !== "",
            );
            serviceConditions = fetchedData.conditions.filter(
              (condition) => condition.trim() !== "",
            );
          }
        }

        const servicePk =
          (data.quotationForm as any).id !== undefined &&
          (data.quotationForm as any).id !== null
            ? Number((data.quotationForm as any).id)
            : null;

        return {
          ...(isEditMode && servicePk ? { id: servicePk } : {}),
          service_id: finalServiceId,
          carrier_code: data.quotationForm.carrier_code,
          icd: selectedService?.icd || "", // Get ICD from enquiry service details
          remark: data.quotationForm.remark,
          valid_upto: data.quotationForm.valid_upto,
          multi_carrier: data.quotationForm.multi_carrier === "true",
          quote_type: data.quotationForm.quote_type,
          total_cost: serviceNetCost,
          total_sell: serviceNetSell,
          profit: serviceProfit,
          quote_currency_country_code:
            data.quotationForm.quote_currency_country_code,
          charges: serviceCharges.map((charge: any) => {
            const base: any = {
              charge_name: charge.charge_name,
              charge_id:
                charge.charge_id !== undefined && charge.charge_id !== null
                  ? Number(charge.charge_id)
                  : null,
              currency_country_code: charge.currency_country_code,
              roe: parseRoeForPayload(charge.roe) ?? 1,
              unit: charge.unit,
              no_of_units: parseNoOfUnitForPayload(charge.no_of_units) ?? 0,
              sell_per_unit: parseCurrencyMoneyForPayload(charge.sell_per_unit),
              min_sell: parseCurrencyMoneyForPayload(charge.min_sell),
              cost_per_unit: parseCurrencyMoneyForPayload(charge.cost_per_unit),
              total_sell: parseLocalMoneyForPayload(charge.total_sell),
              total_cost: parseLocalMoneyForPayload(charge.total_cost),
              // min_cost: parseFloat(charge.min_cost) || 0.0,
            };
            // Include the quotation charge line id when present (existing charge)
            if (charge.id !== undefined && charge.id !== null)
              base.id = charge.id;
            return base;
          }),
          notes: serviceNotes,
          conditions: serviceConditions,
        };
      },
    );

    const payload = {
      enquiry_id: actualEnquiryData?.enquiry_id,
      quotation_services_data: quotationServicesData,
    };

    // Add ID for edit mode
    if (isEditMode && quotationIdForEdit) {
      (payload as any).id = quotationIdForEdit;
    }

    console.log("Final quotation payload:", JSON.stringify(payload, null, 2));
    console.log("Service ID being used:", quotationServicesData[0]?.service_id);

    try {
      let response;
      if (isEditMode) {
        // Edit existing quotation
        console.log("payload----", payload);

        response = await putAPICall(URL.quotation, payload, API_HEADER);
        if (response) {
          // Mark this service as having a quotation
          if (currentServiceId) {
            setServiceQuotationData((prev) => ({
              ...prev,
              [currentServiceId]: {
                ...prev[currentServiceId],
                hasQuotation: true,
              },
            }));
          }

          ToastNotification({
            type: "success",
            message: "Quotation is successfully updated.",
          });
          // Navigate back to appropriate list page with preserved filters if available
          const preserveFilters = location.state?.preserveFilters;
          const fromEnquiry = location.state?.fromEnquiry;

          if (fromEnquiry) {
            // Navigate back to enquiry page with preserved filters
            if (preserveFilters) {
              navigate("/enquiry", {
                state: {
                  restoreFilters: preserveFilters,
                  refreshData: true,
                },
              });
            } else {
              navigate("/enquiry", { state: { refreshData: true } });
            }
          } else {
            navigateToPreferredList(preserveFilters);
          }
        }
      } else {
        // Create new quotation
        console.log("payload----", payload);

        response = await postAPICall(URL.quotation, payload, API_HEADER);
        if (response) {
          // Mark this service as having a quotation
          if (currentServiceId) {
            setServiceQuotationData((prev) => ({
              ...prev,
              [currentServiceId]: {
                ...prev[currentServiceId],
                hasQuotation: true,
              },
            }));
          }

          ToastNotification({
            type: "success",
            message: "Quotation created successfully",
          });
          // After create (including from enquiry "Create Quotation"), go to quotation list
          const preserveFilters = location.state?.preserveFilters;
          navigateToPreferredList(preserveFilters);
        }
      }
    } catch (error) {
      setIsSubmittingQuotation(false);
      ToastNotification({
        type: "error",
        message: `Error on ${isEditMode ? "updating" : "submitting"} quotation:${error}`,
      });
      console.error("Error submitting profile:", error);

      console.log("Testing---", payload);
    }
  };

  const {
    data: currencyData = [],
    isLoading: isCurrencyLoading,
    isError: isCurrencyError,
  } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
    // cacheTime: Infinity,
  });
  console.log("currencyData---", currencyData);

  const {
    data: carrierRes = [],
    isLoading: isCarrierLoading,
    isError: isCarrierError,
  } = useQuery({
    queryKey: ["carrier"],
    queryFn: fetchCarrier,
    staleTime: Infinity,
  });
  // console.log("Carrier result----", carrierRes);

  const { data: rawOtherServicesData = [] } = useQuery({
    queryKey: ["otherServices"],
    queryFn: fetchOtherServices,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const otherServicesData = useMemo((): OtherServiceOption[] => {
    if (!Array.isArray(rawOtherServicesData) || !rawOtherServicesData.length) {
      return [];
    }
    return rawOtherServicesData.map((item: any) => ({
      value: item.service_code ? String(item.service_code) : "",
      label: item.service_name || "",
      transport_mode: item.transport_mode || "",
      full_groupage: item.full_groupage || "",
    }));
  }, [rawOtherServicesData]);

  const quoteCurrency = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.code),
      label: `${item.name} (${item.code})`,
      country_code: item.country_code,
    }));
  }, [currencyData]);

  const currency = useMemo(() => {
    const data = currencyData as any[];
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      value: String(item.code),
      label: item.code,
    }));
  }, [currencyData]);

  const carrierData = useMemo(() => {
    if (!Array.isArray(carrierRes)) return [];
    return carrierRes.map(
      (item: { carrier_code: string; carrier_name: string }) => ({
        value: String(item.carrier_code),
        label: item.carrier_name,
      }),
    );
  }, [carrierRes]);

  const quoteCurrencyCode =
    quotationForm.values.quote_currency_country_code || "";
  const normalizedQuoteCurrency = quoteCurrencyCode.trim().toUpperCase();
  const normalizedLocalCurrency = (branchCurrencyCode ?? "")
    .trim()
    .toUpperCase();
  const showQuoteCurrencyProfit = Boolean(
    normalizedQuoteCurrency &&
      normalizedLocalCurrency &&
      normalizedQuoteCurrency !== normalizedLocalCurrency,
  );

  // Fetch quote-currency ROE from exchange-rate master when quote ≠ branch currency.
  useEffect(() => {
    let cancelled = false;
    if (!showQuoteCurrencyProfit || !normalizedQuoteCurrency) {
      setFetchedQuoteCurrencyRoe(null);
      return;
    }

    void ensureRoeForCurrency(normalizedQuoteCurrency).then((roe) => {
      if (cancelled) return;
      setFetchedQuoteCurrencyRoe(roe != null && roe > 0 ? roe : null);
    });

    return () => {
      cancelled = true;
    };
  }, [
    showQuoteCurrencyProfit,
    normalizedQuoteCurrency,
    ensureRoeForCurrency,
  ]);

  const quoteCurrencyRoeFromCharges = getQuoteCurrencyRoeFromCharges(
    quoteCurrencyCode,
    charges,
  );
  const quoteCurrencyRoe =
    fetchedQuoteCurrencyRoe != null && fetchedQuoteCurrencyRoe > 0
      ? fetchedQuoteCurrencyRoe
      : quoteCurrencyRoeFromCharges > 0
        ? quoteCurrencyRoeFromCharges
        : 1;
  const profitInQuoteCurrency =
    quoteCurrencyRoe > 0 ? profit / quoteCurrencyRoe : profit;

  // Auto-set currency based on user's country code - for each service
  useEffect(() => {
    // Only set currency if we have the necessary data and a selected service
    if (
      user?.country?.country_code &&
      quoteCurrency.length > 0 &&
      selectedService &&
      !quotationForm.values.quote_currency_country_code
    ) {
      // Find currency that matches user's country code
      const matchingCurrency = quoteCurrency.find(
        (currency) => currency.country_code === user.country.country_code,
      );

      if (matchingCurrency) {
        // console.log(
        //   `Auto-setting currency to ${matchingCurrency.value} for country ${user.country.country_code} and service ${selectedService.id}`
        // );
        quotationForm.setFieldValue(
          "quote_currency_country_code",
          matchingCurrency.value,
        );
      } else {
        // Fallback to INR if no matching currency found
        // console.log(
        //   `No currency found for country ${user.country.country_code}, defaulting to INR for service ${selectedService.id}`
        // );
        quotationForm.setFieldValue("quote_currency_country_code", "INR");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.country?.country_code,
    quoteCurrency,
    selectedService?.id,
    currentServiceId,
  ]);

  // Default charge currency for newly added / blank charge rows: active branch currency.
  const defaultChargeCurrencyCode = defaultBranchCurrency || "INR";

  // Keep charges currency in sync for *new/blank* rows only.
  useEffect(() => {
    const nextCurrency = defaultChargeCurrencyCode;
    if (!nextCurrency) return;
    const current = dynamicForm.values.charges;
    if (!Array.isArray(current) || current.length === 0) return;

    const updated = current.map((c) => {
      const cur = String(c.currency_country_code ?? "").trim();
      if (cur) return c; // preserve existing/older charges as received
      return {
        ...c,
        currency_country_code: nextCurrency,
        roe: isBaseCurrency(nextCurrency) ? "1" : "",
      };
    });

    const changed = updated.some(
      (c, i) =>
        c.currency_country_code !== current[i]?.currency_country_code ||
        String(c.roe) !== String(current[i]?.roe),
    );
    if (changed) dynamicForm.setValues({ charges: updated });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultChargeCurrencyCode, isBaseCurrency]);

  // Service selection handler - defined after data is available
  const handleServiceSelect = useCallback(
    (index: number) => {
      // Save current form data before switching
      if (selectedService) {
        // Check if current service has valid data before saving
        const quotationResult = quotationForm.validate();
        const dynamicResult = dynamicForm.validate();
        const hasValidData =
          !quotationResult.hasErrors && !dynamicResult.hasErrors;

        setServiceQuotationData((prev) => ({
          ...prev,
          [selectedService.id]: {
            quotationForm: { ...quotationForm.values }, // Deep copy to prevent reference issues
            dynamicForm: { ...dynamicForm.values }, // Deep copy to prevent reference issues
            hasQuotation: hasValidData,
          },
        }));
      }

      // Switch to new service
      setSelectedServiceIndex(index);
      const newService = services[index];

      if (newService) {
        // Load saved data for this service or reset to defaults
        const savedData = serviceQuotationData[newService.id];
        if (savedData) {
          // Deep copy the saved data to prevent reference issues
          quotationForm.setValues({ ...savedData.quotationForm });
          dynamicForm.setValues({
            charges: savedData.dynamicForm.charges.map((charge: any) => ({
              ...charge,
            })),
          });
        } else {
          // Check for quotation data from any source (standalone edit or enquiryData)
          const quotationDataToUse =
            quotationData?.quotation ||
            actualEnquiryData?.quotation ||
            fetchedQuotationData?.quotation;
          const quotationForService = quotationDataToUse?.find(
            (q: any) => q.service_id === newService.id,
          );

          if (quotationForService) {
            // Load quotation data for this service
            loadQuotationDataForService(
              quotationForService,
              carrierData,
              currencyData,
            );
          } else {
            // Reset forms for new service with completely fresh data
            resetFormsToDefaults();
          }
        }

        // Clear charges and reset carrier comparison for new service
        setCharges([]);
        setCarrierComparisonData(null);
      }
    },
    [
      selectedService,
      quotationForm,
      dynamicForm,
      serviceQuotationData,
      services,
      quotationData,
      actualEnquiryData,
      fetchedQuotationData,
      carrierData,
      currencyData,
      loadQuotationDataForService,
    ],
  );

  useEffect(() => {
    if (
      enquiryData?.serviceQuotationState &&
      Object.keys(enquiryData.serviceQuotationState).length > 0 &&
      Object.keys(serviceQuotationData).length === 0
    ) {
      const normalizedState: {
        [serviceId: number]: {
          quotationForm: any;
          dynamicForm: { charges: any[] };
          hasQuotation: boolean;
        };
      } = {};

      Object.entries(enquiryData.serviceQuotationState).forEach(
        ([key, value]) => {
          if (!value) return;
          const numericKey = Number(key);
          if (Number.isNaN(numericKey)) return;

          normalizedState[numericKey] = {
            quotationForm: { ...(value as any).quotationForm },
            dynamicForm: {
              charges: Array.isArray((value as any).dynamicForm?.charges)
                ? (value as any).dynamicForm.charges.map((charge: any) => ({
                    ...charge,
                  }))
                : [],
            },
            hasQuotation: Boolean((value as any).hasQuotation),
          };
        },
      );

      if (Object.keys(normalizedState).length === 0) {
        return;
      }

      setServiceQuotationData(normalizedState);

      const serviceWithData =
        services.find(
          (service) => service?.id && normalizedState[service.id],
        ) || services[0];

      if (serviceWithData && normalizedState[serviceWithData.id]) {
        quotationForm.setValues({
          ...normalizedState[serviceWithData.id].quotationForm,
        });
        dynamicForm.setValues({
          charges: normalizedState[serviceWithData.id].dynamicForm.charges.map(
            (charge: any) => ({ ...charge }),
          ),
        });

        const serviceIndex = services.findIndex(
          (service) => service.id === serviceWithData.id,
        );
        if (serviceIndex >= 0) {
          setSelectedServiceIndex(serviceIndex);
        }
      }
    }
  }, [
    enquiryData?.serviceQuotationState,
    services,
    serviceQuotationData,
    quotationForm,
    dynamicForm,
  ]);

  // Initialize form data for edit mode (from list row or fetched quotation)
  useEffect(() => {
    const quotationDataToUse =
      fetchedQuotationData?.quotation ||
      quotationData?.quotation ||
      actualEnquiryData?.quotation;
    const quotationHeader: QuotationHeaderRemarkSource | null | undefined =
      fetchedQuotationData ||
      actualEnquiryData ||
      quotationData;
    const hasQuotationData =
      quotationDataToUse &&
      Array.isArray(quotationDataToUse) &&
      quotationDataToUse.length > 0;

    // Run when we have quotation data and services; don't block on carrier/currency so list-edit shows charges immediately
    if (
      (isEditMode || hasQuotationData) &&
      (quotationData ||
        actualEnquiryData?.quotation ||
        fetchedQuotationData?.quotation) &&
      services.length > 0
    ) {
      console.log("Initializing form for edit mode:", quotationHeader);

      const initialServiceData: { [serviceId: number]: any } = {};
      const carrierList = Array.isArray(carrierData) ? carrierData : [];
      const currencyList = Array.isArray(currencyData) ? currencyData : [];

      services.forEach((service) => {
        const quotationForService = quotationDataToUse?.find(
          (q: any) => q.service_id === service.id,
        );

        if (quotationForService) {
          const matchedCarrier = carrierList.find(
            (carrier: any) => carrier.label === quotationForService.carrier,
          );
          const carrierCode = matchedCarrier?.value || "";

          const matchedCurrency = currencyList.find(
            (currency: any) =>
              currency.name === quotationForService.quote_currency ||
              currency.code === quotationForService.quote_currency,
          );
          const currencyCode =
            matchedCurrency?.code || quotationForService.quote_currency || "";

          // Prepare form data for this service
          const quotationForm = {
            // In edit mode, keep primary key (quotation_service_id) so we can send it in payload
            ...(isEditMode && quotationForService.quotation_service_id
              ? { id: quotationForService.quotation_service_id }
              : {}),
            quote_currency_country_code: currencyCode,
            valid_upto: quotationForService.valid_upto || "",
            multi_carrier: quotationForService.multi_carrier ? "true" : "false",
            quote_type: quotationForService.quote_type || "Standard",
            carrier_code: carrierCode,
            status: quotationHeader?.status || "QUOTE CREATED",
            remark: resolveQuotationRemark(
              quotationHeader,
              quotationForService.remark,
            ),
          };

          // Prepare charges data for this service (include charge_id for SearchableSelect value)
          const charges =
            quotationForService.charges &&
            quotationForService.charges.length > 0
              ? quotationForService.charges.map((charge: any) => ({
                  charge_name: charge.charge_name || "",
                  charge_id: charge.charge_id ?? null,
                  currency_country_code: charge.currency || "",
                  roe: formatRoeAsString(charge.roe) || "1",
                  unit: charge.unit || "",
                  no_of_units: formatQuotationNoOfUnitsFromApi(
                    charge.no_of_units,
                  ),
                  sell_per_unit: currencyApiValueToFormString(charge.sell_per_unit),
                  min_sell: currencyApiValueToFormString(charge.min_sell),
                  cost_per_unit: currencyApiValueToFormString(charge.cost_per_unit),
                  total_cost: localApiValueToFormString(charge.total_cost),
                  total_sell: localApiValueToFormString(charge.total_sell),
                  // preserve charge line id from API
                  id:
                    charge.id ?? charge.charge_id ?? charge.quotation_charge_id,
                }))
              : [
                  {
                    charge_name: "",
                    charge_id: null,
                    currency_country_code: defaultBranchCurrency || "INR",
                    roe:
                      defaultBranchCurrency &&
                      isBaseCurrency(defaultBranchCurrency)
                        ? "1"
                        : "",
                    unit: "",
                    no_of_units: "",
                    sell_per_unit: "",
                    min_sell: "",
                    cost_per_unit: "",
                    total_cost: "",
                    total_sell: "",
                  },
                ];

          initialServiceData[service.id] = {
            quotationForm,
            dynamicForm: { charges },
            hasQuotation: true,
          };
        }
      });

      // Set the service data
      setServiceQuotationData(initialServiceData);

      // Load data for the first service (default selected)
      const firstService = services[0];
      if (firstService && initialServiceData[firstService.id]) {
        const firstServiceData = initialServiceData[firstService.id];
        quotationForm.setValues(firstServiceData.quotationForm);
        dynamicForm.setValues(firstServiceData.dynamicForm);
      }
    }
  }, [
    isEditMode,
    quotationData,
    actualEnquiryData,
    fetchedQuotationData,
    carrierData,
    currencyData,
    services,
  ]);

  // Fetch carrier comparison data when component mounts or enquiry data changes
  useEffect(() => {
    if (actualEnquiryData?.enquiry_id && actualEnquiryData.service === "FCL") {
      fetchCarrierComparison();
    }
  }, [
    actualEnquiryData?.enquiry_id,
    actualEnquiryData?.service,
    selectedService?.icd,
  ]);

  // Sync selected carrier with form value
  useEffect(() => {
    const carrierCode = quotationForm.values.carrier_code;
    if (carrierCode !== selectedCarrierCode) {
      setSelectedCarrierCode(carrierCode);
    }
  }, [quotationForm.values.carrier_code]);

  async function getCharges(
    destinationOption: any,
    enquiryID: any,
    carrierVal: any,
    service: any,
    serviceId: any,
  ) {
    try {
      // Get ICD from selected service details (from enquiry)
      const icdValue = selectedService?.icd || "";
      const payload = {
        enquiry_id: enquiryID,
        service: service,
        carrier_code: service === "LCL" ? "" : carrierVal, // For LCL, carrier is not required
        name: destinationOption,
        icd: icdValue,
        service_id: serviceId, // Add service_id to payload
      };
      console.log("payload-----------", payload);

      // const response = await getAPICall(
      //   `comprehensive/${destinationOption}?enquiry_id=${enquiryID}&carrier=${carrierVal}`,
      //   API_HEADER
      // );
      const response = await postAPICall(URL.getcharges, payload, API_HEADER);
      console.log("getCharges response------", response);
      return response;
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  async function fetchCarrierComparison() {
    setIsLoadingCarriers(true);
    try {
      // Get ICD from selected service details (from enquiry)
      const icdValue = selectedService?.icd || "";
      const payload = {
        enquiry_id: actualEnquiryData.enquiry_id,
        service: selectedService?.service,
        icd: icdValue,
        service_id: currentServiceId, // Add service_id to payload
      };

      const response = await postAPICall(
        URL.carrierComparison,
        payload,
        API_HEADER,
      );
      console.log("Carrier comparison response:", response);
      setCarrierComparisonData(response as CarrierComparisonData);
    } catch (error) {
      console.error("Error fetching carrier comparison:", error);
      ToastNotification({
        type: "error",
        message: "Failed to fetch carrier comparison data",
      });
    } finally {
      setIsLoadingCarriers(false);
    }
  }

  async function fetchNotesAndConditions(serviceId?: number) {
    const serviceToUse = selectedService;
    const serviceIdToUse = serviceId || serviceToUse?.id;

    if (!serviceToUse || !serviceIdToUse) {
      return;
    }

    // Skip if already fetched for this service
    if (fetchedNotesConditions[serviceIdToUse]) {
      return;
    }

    setIsLoadingNotesConditions(true);
    try {
      const payload = {
        service: serviceToUse.service,
        country: user?.country?.country_code || "",
        service_type: serviceToUse.trade,
      };

      console.log("Fetching notes and conditions with payload:", payload);

      const response: any = await postAPICall(
        URL.conditionalNotes,
        payload,
        API_HEADER,
      );

      console.log("Notes and conditions response:", response);

      if (response && response.status) {
        // API returns simple arrays: notes: ["text1", "text2"], conditions: ["text1", "text2"]
        const fetchedNotes = response.data.notes || [];
        const fetchedConditions = response.data.conditions || [];

        const notesArray =
          Array.isArray(fetchedNotes) && fetchedNotes.length > 0
            ? fetchedNotes
            : [""];
        const conditionsArray =
          Array.isArray(fetchedConditions) && fetchedConditions.length > 0
            ? fetchedConditions
            : [""];

        // Store fetched data per service
        setFetchedNotesConditions((prev) => ({
          ...prev,
          [serviceIdToUse]: {
            notes: notesArray,
            conditions: conditionsArray,
          },
        }));
      } else {
        // Set empty arrays with one empty string for initial input
        setFetchedNotesConditions((prev) => ({
          ...prev,
          [serviceIdToUse]: {
            notes: [""],
            conditions: [""],
          },
        }));
      }
    } catch (error) {
      console.error("Error fetching notes and conditions:", error);
      // Set empty arrays with one empty string for initial input
      setFetchedNotesConditions((prev) => ({
        ...prev,
        [serviceIdToUse]: {
          notes: [""],
          conditions: [""],
        },
      }));
    } finally {
      setIsLoadingNotesConditions(false);
    }
  }

  async function fetchChargeHistory() {
    if (!selectedService) {
      ToastNotification({
        type: "warning",
        message: "Please select a service first",
      });
      return;
    }

    // Get quotation data from either actualEnquiryData or fetchedQuotationData
    const quotationDataToUse =
      actualEnquiryData?.quotation || fetchedQuotationData?.quotation;

    if (!quotationDataToUse || !Array.isArray(quotationDataToUse)) {
      ToastNotification({
        type: "warning",
        message: "No quotation data available",
      });
      return;
    }

    // Find the quotation for the current service
    const quotationForService = quotationDataToUse.find(
      (q: any) => q.service_id === selectedService.id,
    );

    if (!quotationForService?.quotation_service_id) {
      ToastNotification({
        type: "warning",
        message: "Quotation service ID not found for the selected service",
      });
      return;
    }

    setIsLoadingChargeHistory(true);
    setChargeHistoryModalOpened(true);
    setChargeHistoryData([]);

    try {
      const payload = {
        service_id: quotationForService.quotation_service_id,
      };

      console.log("Fetching charge history with payload:", payload);

      const response: any = await postAPICall(
        URL.quotationChargeHistory,
        payload,
        API_HEADER,
      );

      console.log("Charge history response:", response);

      if (response && response.status && response.data) {
        setChargeHistoryData(response.data);
      } else {
        setChargeHistoryData([]);
        ToastNotification({
          type: "info",
          message: response?.message || "No charge history found",
        });
      }
    } catch (error: any) {
      console.error("Error fetching charge history:", error);
      setChargeHistoryData([]);
      ToastNotification({
        type: "error",
        message: `Failed to fetch charge history: ${error?.message || "Unknown error"}`,
      });
    } finally {
      setIsLoadingChargeHistory(false);
    }
  }

  const handleCarrierCardClick = (carrier: any) => {
    // Store the carrier temporarily (don't update form yet)
    setTempSelectedCarrier(carrier);

    // Open the tariff popup
    open();
  };

  const handleOpenNotesConditionsModal = () => {
    if (!selectedService) {
      ToastNotification({
        type: "warning",
        message: "Please select a service first",
      });
      return;
    }

    // In edit mode, check if quotation already has notes/conditions for this service
    if (isEditMode && actualEnquiryData?.quotation) {
      const quotationForService = actualEnquiryData.quotation.find(
        (q: any) => q.service_id === selectedService.id,
      );

      if (
        quotationForService &&
        (quotationForService.notes || quotationForService.conditions)
      ) {
        // Use existing notes and conditions from quotation
        setNotes(
          Array.isArray(quotationForService.notes) &&
            quotationForService.notes.length > 0
            ? quotationForService.notes
            : [""],
        );
        setConditions(
          Array.isArray(quotationForService.conditions) &&
            quotationForService.conditions.length > 0
            ? quotationForService.conditions
            : [""],
        );
        setNotesConditionsModalOpened(true);
        return;
      }
    }

    // For create mode, use pre-fetched data
    const fetchedData = fetchedNotesConditions[selectedService.id];
    if (fetchedData) {
      setNotes(fetchedData.notes);
      setConditions(fetchedData.conditions);
    } else {
      // Fallback: if not fetched yet, use empty arrays
      setNotes([""]);
      setConditions([""]);
    }
    setNotesConditionsModalOpened(true);
  };

  const handleUpdateNotesConditions = () => {
    if (!selectedService?.id) return;

    // Filter out empty strings
    const filteredNotes = notes.filter((note) => note.trim() !== "");
    const filteredConditions = conditions.filter(
      (condition) => condition.trim() !== "",
    );

    // Update state with filtered values
    const updatedNotes = filteredNotes.length > 0 ? filteredNotes : [""];
    const updatedConditions =
      filteredConditions.length > 0 ? filteredConditions : [""];

    setNotes(updatedNotes);
    setConditions(updatedConditions);

    // Also update the fetched data state so it persists if modal is reopened
    setFetchedNotesConditions((prev) => ({
      ...prev,
      [selectedService.id]: {
        notes: updatedNotes,
        conditions: updatedConditions,
      },
    }));

    // Close modal
    setNotesConditionsModalOpened(false);

    ToastNotification({
      type: "success",
      message: "Notes and conditions updated successfully",
    });
  };

  const handleAddNote = () => {
    setNotes([...notes, ""]);
  };

  const handleAddCondition = () => {
    setConditions([...conditions, ""]);
  };

  const handleNoteChange = (index: number, value: string) => {
    const updatedNotes = [...notes];
    updatedNotes[index] = value;
    setNotes(updatedNotes);
  };

  const handleConditionChange = (index: number, value: string) => {
    const updatedConditions = [...conditions];
    updatedConditions[index] = value;
    setConditions(updatedConditions);
  };

  const handleRemoveNote = (index: number) => {
    if (notes.length > 1) {
      const updatedNotes = notes.filter((_, i) => i !== index);
      setNotes(updatedNotes);
    }
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length > 1) {
      const updatedConditions = conditions.filter((_, i) => i !== index);
      setConditions(updatedConditions);
    }
  };

  const scrollNotesDown = () => {
    if (notesScrollRef.current) {
      notesScrollRef.current.scrollBy({
        top: INPUT_CONTAINER_MAX_HEIGHT,
        behavior: "smooth",
      });
    }
  };

  const scrollConditionsDown = () => {
    if (conditionsScrollRef.current) {
      conditionsScrollRef.current.scrollBy({
        top: INPUT_CONTAINER_MAX_HEIGHT,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (!notesConditionsModalOpened) {
      setNotesScrollable(false);
      setConditionsScrollable(false);
      setNotesAtBottom(true);
      setConditionsAtBottom(true);
      return;
    }

    const updateNotesScrollState = () => {
      const el = notesScrollRef.current;
      if (!el) {
        setNotesScrollable(false);
        setNotesAtBottom(true);
        return;
      }
      const isScrollable = el.scrollHeight > INPUT_CONTAINER_MAX_HEIGHT;
      setNotesScrollable(isScrollable);
      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 4 || !isScrollable;
      setNotesAtBottom(atBottom);
    };

    const updateConditionsScrollState = () => {
      const el = conditionsScrollRef.current;
      if (!el) {
        setConditionsScrollable(false);
        setConditionsAtBottom(true);
        return;
      }
      const isScrollable = el.scrollHeight > INPUT_CONTAINER_MAX_HEIGHT;
      setConditionsScrollable(isScrollable);
      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 4 || !isScrollable;
      setConditionsAtBottom(atBottom);
    };

    const notesEl = notesScrollRef.current;
    const conditionsEl = conditionsScrollRef.current;

    const handleNotesScroll = () => updateNotesScrollState();
    const handleConditionsScroll = () => updateConditionsScrollState();

    updateNotesScrollState();
    updateConditionsScrollState();

    if (notesEl) {
      notesEl.addEventListener("scroll", handleNotesScroll);
    }
    if (conditionsEl) {
      conditionsEl.addEventListener("scroll", handleConditionsScroll);
    }

    return () => {
      if (notesEl) {
        notesEl.removeEventListener("scroll", handleNotesScroll);
      }
      if (conditionsEl) {
        conditionsEl.removeEventListener("scroll", handleConditionsScroll);
      }
    };
  }, [notesConditionsModalOpened, notes, conditions]);

  // Helper function to calculate no_of_units based on service, unit, and enquiry/quotation data
  const calculateNoOfUnits = useCallback(
    (service: string, unit: string, serviceId?: number): string => {
      if (!service || !unit) {
        return "";
      }

      const resolveServiceContext = (): {
        serviceType: string;
        cargoDetails: Array<Record<string, unknown>>;
        primaryCargo: Record<string, unknown>;
      } | null => {
        let enquiryService: Record<string, unknown> | null = null;

        if (actualEnquiryData?.services?.length) {
          enquiryService =
            (serviceId
              ? actualEnquiryData.services.find((s: any) => s.id === serviceId)
              : actualEnquiryData.services.find(
                  (s: any) => s.service === service,
                )) || actualEnquiryData.services[0];
        }

        if (!enquiryService && services.length > 0) {
          enquiryService =
            (serviceId
              ? services.find((s) => s.id === serviceId)
              : services.find((s) => s.service === service)) ||
            selectedService ||
            services[0];
        }

        if (!enquiryService) {
          return null;
        }

        const cargoDetails = (
          (enquiryService.cargo_details as Array<Record<string, unknown>>) ||
          (enquiryService.fcl_details as Array<Record<string, unknown>>) ||
          []
        ).filter(Boolean);

        const primaryCargo: Record<string, unknown> = cargoDetails[0] || {
          gross_weight: enquiryService.gross_weight,
          volume: enquiryService.volume,
          volume_weight: enquiryService.volume_weight,
          chargeable_weight:
            enquiryService.chargeable_weight ?? enquiryService.chargable_weight,
          chargable_weight:
            enquiryService.chargable_weight ?? enquiryService.chargeable_weight,
          chargeable_volume:
            enquiryService.chargeable_volume ??
            enquiryService.chargable_volume,
          chargable_volume:
            enquiryService.chargable_volume ?? enquiryService.chargeable_volume,
        };

        return {
          serviceType: String(enquiryService.service || service),
          cargoDetails,
          primaryCargo,
        };
      };

      const context = resolveServiceContext();
      if (!context) {
        return "";
      }

      const { serviceType, cargoDetails, primaryCargo } = context;
      const unitUpper = unit.toUpperCase();

      // AIR service logic
      if (serviceType === "AIR") {
        if (unitUpper === "KG") {
          return formatQuotationNoOfUnitsFromApi(
            primaryCargo.chargable_weight ?? primaryCargo.chargeable_weight,
          );
        }
        if (
          unitUpper === "SHIPMENT" ||
          unitUpper === "SHPT" ||
          unitUpper === "DOC"
        ) {
          return "1";
        }
      }

      // LCL service logic
      if (serviceType === "LCL") {
        if (unitUpper === "W/M") {
          return formatQuotationNoOfUnitsFromApi(
            primaryCargo.chargable_volume ?? primaryCargo.chargeable_volume,
          );
        }
        if (unitUpper === "CBM") {
          return formatQuotationNoOfUnitsFromApi(primaryCargo.volume);
        }
        if (unitUpper === "SHPT" || unitUpper === "DOC") {
          return "1";
        }
      }

      // FCL service logic
      if (serviceType === "FCL") {
        if (
          unitUpper === "SHIPMENT" ||
          unitUpper === "SHPT" ||
          unitUpper === "DOC"
        ) {
          return "1";
        }

        const matchingCargo = cargoDetails.find(
          (cargo) =>
            String(cargo.container_type_code || "").toUpperCase() ===
              unitUpper ||
            String(cargo.container_type || "").toUpperCase() === unitUpper,
        );

        if (matchingCargo) {
          return formatQuotationNoOfUnitsFromApi(
            matchingCargo.no_of_containers,
          );
        }
      }

      return "";
    },
    [actualEnquiryData, selectedService, services],
  );

  const applyChargeUnitSelection = useCallback(
    (index: number, value: string | null) => {
      const unitValue = value || "";
      dynamicForm.setFieldValue(`charges.${index}.unit`, unitValue);

      if (!value || !selectedService) {
        syncChargeTotalsAtIndex(index, { unit: unitValue });
        return;
      }

      const calculatedNoOfUnits = calculateNoOfUnits(
        selectedService.service,
        value,
        selectedService.id,
      );

      if (calculatedNoOfUnits) {
        dynamicForm.setFieldValue(
          `charges.${index}.no_of_units`,
          calculatedNoOfUnits,
        );
        syncChargeTotalsAtIndex(index, {
          unit: unitValue,
          no_of_units: calculatedNoOfUnits,
        });
      } else {
        syncChargeTotalsAtIndex(index, { unit: unitValue });
      }
    },
    [
      dynamicForm,
      selectedService,
      calculateNoOfUnits,
      syncChargeTotalsAtIndex,
    ],
  );

  // Fetch unit data based on service type
  const fetchUnitData = useCallback(async (serviceType: string, serviceId?: number) => {
      setIsLoadingUnitData(true);
      try {
        const payload = {
          filters: {
            service_type: serviceType,
          },
        };
        const response: any = await postAPICall(
          URL.unitMasterFilter,
          payload,
          API_HEADER,
        );
        console.log("Unit data response:", response);

        if (response && response.data && Array.isArray(response.data)) {
          let filteredData = response.data;

          // Special handling for FCL service
          // Check for cargo details from multiple sources:
          // 1. actualEnquiryData?.services (for create mode from enquiry page)
          // 2. selectedService?.fcl_details (for edit mode from quotation data)
          // 3. selectedService?.cargo_details (fallback)
          if (serviceType === "FCL") {
            // Resolve container details for the currently selected service step.
            let cargoDetails: any[] = [];
            const currentEnquiryData = actualEnquiryDataRef.current;
            const currentSelectedService = selectedServiceRef.current;
            const selectedServiceData: any =
              (serviceId &&
                currentEnquiryData?.services?.find(
                  (service: any) => service.id === serviceId,
                )) ||
              currentSelectedService;

            if (Array.isArray(selectedServiceData?.cargo_details)) {
              cargoDetails = selectedServiceData.cargo_details;
            } else if (Array.isArray(selectedServiceData?.fcl_details)) {
              cargoDetails = selectedServiceData.fcl_details;
            }

            const containerTypeCodes = [
              ...new Set(
                cargoDetails
                  .map((cargo: any) =>
                    (cargo.container_type_code || cargo.container_type || "")
                      .toString()
                      .trim()
                      .toUpperCase(),
                  )
                  .filter(Boolean),
              ),
            ];

            console.log(
              "Container type codes from enquiry:",
              containerTypeCodes,
            );

            // Filter unit master response to include:
            // 1. All units where service_type === "ALL"
            // 2. The "shipment" unit (unit_code === "shipment") - usually in ALL but keeping for safety
            // 3. Units where unit_code matches any container_type_code from cargo_details
            filteredData = response.data.filter((item: any) => {
              const unitCode = (item.unit_code || "")
                .toString()
                .trim()
                .toUpperCase();
              return (
                item.service_type === "ALL" ||
                unitCode === "SHIPMENT" ||
                containerTypeCodes.includes(unitCode)
              );
            });

            console.log("Filtered unit data for FCL:", filteredData);
          }

          const formattedData = filteredData.map((item: any) => ({
            value: item.unit_code,
            label:
              // item.unit_name ||
              item.unit_code,
          }));
          setUnitData(formattedData);
        } else {
          setUnitData([]);
        }
      } catch (error) {
        console.error("Error fetching unit data:", error);
        setUnitData([]);
      } finally {
        setIsLoadingUnitData(false);
      }
    }, []);

  // Fetch unit data when selected service changes
  useEffect(() => {
    if (!selectedService?.service) return;
    if (isDirectQuoteFromList && !isDirectEnquiryComplete) return;
    fetchUnitData(selectedService.service, selectedService.id);
  }, [
    fetchUnitData,
    isDirectEnquiryComplete,
    isDirectQuoteFromList,
    selectedService?.id,
    selectedService?.service,
  ]);

  // Fetch default charges for create mode only - per selected service
  useEffect(() => {
    const hasMeaningfulQuotationCharges = (
      charges: Array<{ charge_name?: string }>,
    ) =>
      charges.some(
        (charge) => charge.charge_name && charge.charge_name.trim() !== "",
      );

    const hasUserEditedChargePricing = (
      charges: Array<{
        sell_per_unit?: string;
        cost_per_unit?: string;
        min_sell?: string;
      }>,
    ) =>
      charges.some(
        (charge) =>
          String(charge.sell_per_unit ?? "").trim() !== "" ||
          String(charge.cost_per_unit ?? "").trim() !== "" ||
          String(charge.min_sell ?? "").trim() !== "",
      );

    const fetchDefaultCharges = async () => {
      // Only fetch for create mode (not edit mode)
      if (isEditMode) {
        console.log("Edit mode detected, skipping default charges fetch");
        return;
      }

      if (!selectedService) {
        console.log("No selected service found");
        return;
      }

      if (!isDirectQuoteFromList && !actualEnquiryData) {
        console.log("No enquiry data found");
        return;
      }

      if (!selectedService.trade || !selectedService.service) {
        console.log("Service trade/type incomplete", selectedService);
        return;
      }

      if (!isDirectQuoteFromList && !selectedService.id) {
        console.log("Service id missing for enquiry quotation flow");
        return;
      }

      if (!isDirectQuoteFromList && !actualEnquiryData?.id) {
        console.log("Enquiry id missing for default charges fetch");
        return;
      }

      const filterSignature = `${selectedService.trade}|${selectedService.service}`;
      const serviceTabId = selectedService.id;
      const previousFilter =
        directQuoteChargesFilterRef.current[serviceTabId];
      const directTradeOrServiceChanged =
        isDirectQuoteFromList &&
        previousFilter !== undefined &&
        previousFilter !== filterSignature;

      const defaultChargesKey = isDirectQuoteFromList
        ? `direct-${serviceTabId}-${selectedService.trade}-${selectedService.service}`
        : `${actualEnquiryData?.id ?? ""}-${selectedService.id}`;
      const isSameDirectFilter =
        isDirectQuoteFromList && previousFilter === filterSignature;
      if (
        fetchedDefaultChargesRef.current[defaultChargesKey] &&
        !(isDirectQuoteFromList && !isSameDirectFilter)
      ) {
        return;
      }

      const savedData = serviceQuotationData[selectedService.id];
      const currentCharges = dynamicForm.values.charges;
      const userEditedCurrentPricing =
        hasUserEditedChargePricing(currentCharges);
      const userEditedSavedPricing =
        savedData != null &&
        hasUserEditedChargePricing(savedData.dynamicForm.charges);

      if (isDirectQuoteFromList && directTradeOrServiceChanged) {
        if (userEditedCurrentPricing || userEditedSavedPricing) {
          directQuoteChargesFilterRef.current[serviceTabId] = filterSignature;
          return;
        }
      } else {
        // Don't fetch if service already has saved quotation data with meaningful charges
        if (savedData && savedData.dynamicForm.charges.length > 0) {
          if (hasMeaningfulQuotationCharges(savedData.dynamicForm.charges)) {
            console.log("Service already has charges data, skipping fetch");
            return;
          }
        }

        // Don't fetch if current form already has meaningful charges
        if (
          currentCharges.length > 0 &&
          hasMeaningfulQuotationCharges(currentCharges)
        ) {
          console.log("Form already has charges data, skipping fetch");
          return;
        }
      }

      const payload = isDirectQuoteFromList
        ? {
            filter: {
              trade: selectedService.trade,
              service: selectedService.service,
            },
          }
        : {
            filter: {
              trade: selectedService.trade.toUpperCase(),
              enquiry_id: actualEnquiryData!.id,
              service_id: selectedService.id,
            },
          };

      console.log(
        "Fetching default charges for service:",
        selectedService.id,
        "with payload:",
        payload,
      );

      try {
        const response: any = await postAPICall(
          URL.quotationDefaultChargesFilter,
          payload,
          API_HEADER,
        );

        console.log("Default charges response:", response);

        if (
          response &&
          response.status === "success" &&
          response.data &&
          Array.isArray(response.data)
        ) {
          // Map the response to form charges format
          const mappedCharges = response.data.map((charge: any) => {
            const currencyCode = charge.currency || defaultBranchCurrency || "INR";
            const calculatedRoe = isBaseCurrency(currencyCode) ? 1 : "";
            const unit = charge.unit || "";

            // Calculate no_of_units based on service and unit (not from API response)
            const calculatedNoOfUnits = unit
              ? calculateNoOfUnits(
                  selectedService.service,
                  unit,
                  selectedService.id,
                )
              : "";

            return {
              charge_name: charge.charge_name || "",
              charge_id: charge.charge_id ?? null,
              currency_country_code: currencyCode,
              roe: calculatedRoe,
              unit: unit,
              no_of_units: calculatedNoOfUnits,
              sell_per_unit: "",
              min_sell: "",
              cost_per_unit: "",
              total_cost: "",
              total_sell: "",
              toBeDisabled: false,
            };
          });

          console.log("Mapped default charges:", mappedCharges);

          const latestCharges = dynamicForm.values.charges;
          const userHasEditedPricing =
            hasUserEditedChargePricing(latestCharges);
          const emptyChargeRow = {
            charge_name: "",
            charge_id: null,
            ...getDefaultNewChargeFields(),
            unit: "",
            no_of_units: "",
            sell_per_unit: "",
            min_sell: "",
            cost_per_unit: "",
            total_cost: "",
            total_sell: "",
            toBeDisabled: false,
          };

          if (isDirectQuoteFromList && !userHasEditedPricing) {
            const shouldReplaceDirectCharges =
              directTradeOrServiceChanged ||
              !hasMeaningfulQuotationCharges(latestCharges);

            if (shouldReplaceDirectCharges) {
              const chargesToApply =
                mappedCharges.length > 0 ? mappedCharges : [emptyChargeRow];

              dynamicForm.setValues({ charges: chargesToApply });
              if (selectedService.id) {
                setServiceQuotationData((prev) => ({
                  ...prev,
                  [selectedService.id]: {
                    quotationForm: { ...quotationForm.values },
                    dynamicForm: { charges: chargesToApply },
                    hasQuotation: mappedCharges.length > 0,
                  },
                }));
              }
            }
          } else if (
            !isDirectQuoteFromList &&
            mappedCharges.length > 0 &&
            !hasMeaningfulQuotationCharges(latestCharges)
          ) {
            dynamicForm.setValues({ charges: mappedCharges });
          }

          if (isDirectQuoteFromList) {
            directQuoteChargesFilterRef.current[serviceTabId] = filterSignature;
          }
        }
        fetchedDefaultChargesRef.current[defaultChargesKey] = true;
      } catch (error) {
        console.error("Error fetching default charges:", error);
        // Don't show error toast as this is optional functionality
      }
    };

    fetchDefaultCharges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    actualEnquiryData?.id,
    dynamicForm,
    defaultBranchCurrency,
    isBaseCurrency,
    isDirectQuoteFromList,
    isEditMode,
    selectedService?.id,
    selectedService?.service,
    selectedService?.trade,
    serviceQuotationData,
  ]);

  // Fetch notes and conditions for create mode only - per selected service
  useEffect(() => {
    const fetchNotesConditions = async () => {
      // Only fetch for create mode (not edit mode)
      if (isEditMode) {
        console.log("Edit mode detected, skipping notes and conditions fetch");
        return;
      }

      // Check if we have the necessary data
      if (!selectedService || !user?.country?.country_code) {
        console.log("No selected service or user country found");
        return;
      }

      // Check if service data has required fields
      if (
        !selectedService.service ||
        !selectedService.trade ||
        !selectedService.id
      ) {
        console.log("Service data incomplete", selectedService);
        return;
      }

      // Skip if already fetched for this service
      if (fetchedNotesConditions[selectedService.id]) {
        console.log("Notes and conditions already fetched for this service");
        return;
      }

      console.log(
        "Fetching notes and conditions for service:",
        selectedService.id,
      );

      // Fetch notes and conditions
      await fetchNotesAndConditions(selectedService.id);
    };

    fetchNotesConditions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedService?.id,
    selectedService?.service,
    selectedService?.trade,
    isEditMode,
    user?.country?.country_code,
  ]);

  const tariffSubmit = async () => {
    console.log("Enquiry data----", actualEnquiryData);
    // Get ICD from selected service details (from enquiry)
    const icdVal = selectedService?.icd || "";

    // Use the temporary selected carrier if available, otherwise use form value
    const carrierVal =
      tempSelectedCarrier?.carrier_code || quotationForm.values.carrier_code;
    const enquiryID = actualEnquiryData.enquiry_id;
    const service = selectedService?.service;
    const trariffType = tariffOption.values.tariffVal;

    setCharges([]);
    console.log("carrierrr value-----", carrierVal);
    console.log("enquiryID-----", enquiryID);
    console.log("service---", service);

    const isValid = tariffOption.validate();
    // console.log("is valid check----", isValid);

    if (!isValid.hasErrors) {
      setIsSubmittingTariff(true);
      // Close the popup immediately when starting submission
      close();

      try {
        switch (trariffType) {
          case "all_inclusive": {
            const response = await getCharges(
              "all-inclusive",
              enquiryID,
              carrierVal,
              service,
              icdVal,
              currentServiceId,
            );
            console.log("All-Inclusive response----", response);

            const responseData = response as any;
            const containerRates = responseData?.charges?.container_rates || [];

            // Take currency and unit from first container (if present)
            const firstContainer = containerRates[0] || {};

            const processedCharges = [
              {
                charge_name: "DESTINATION CHARGES",
                currency:
                  firstContainer.currency ??
                  responseData.charges?.currency ??
                  "INR",
                unit: firstContainer.container_type ?? "shipment",
                quantity: "1",
                rate:
                  responseData.charges?.total_all_inclusive?.toString() ?? "",
              },
            ];

            const formattedChargesData = {
              enquiry_id: responseData.enquiry_id,
              charges: processedCharges.map((charge: any) => ({
                charge_name: charge.charge_name,
                currency: charge.currency,
                unit: "shipment",
                quantity: charge.quantity,
                rate: charge.rate,
              })),
            };

            setCharges([formattedChargesData]);

            // Update the actual selected carrier and form
            if (tempSelectedCarrier) {
              setSelectedCarrierCode(tempSelectedCarrier.carrier_code);
              quotationForm.setFieldValue(
                "carrier_code",
                tempSelectedCarrier.carrier_code,
              );
              setTempSelectedCarrier(null);
            }

            break;
          }

          case "per_container": {
            const response = await getCharges(
              "per-container",
              enquiryID,
              carrierVal,
              service,
              icdVal,
              currentServiceId,
            );
            console.log("Container response----", response);

            const responseData = response as any;
            const containerRates = responseData?.charges?.container_rates || [];
            console.log("containerRates----", containerRates);

            let processedCharges = [];

            if (containerRates.length === 1) {
              const container = containerRates[0];

              processedCharges = [
                {
                  charge_name: "DESTINATION CHARGES",
                  currency: responseData.charges?.currency ?? "INR",
                  unit: container.container_type ?? "shipment",
                  quantity: container.quantity?.toString() ?? "",
                  rate: container.per_container_rate?.toString() ?? "",
                },
              ];
            } else if (containerRates.length > 1) {
              processedCharges = containerRates.map((container: any) => ({
                charge_name: "DESTINATION CHARGES",
                currency: responseData.charges?.currency ?? "INR",
                unit: container.container_type ?? "shipment",
                quantity: container.quantity?.toString() ?? "",
                rate: container.per_container_rate?.toString() ?? "",
              }));
            }

            const formattedChargesData = {
              enquiry_id: responseData?.enquiry_id,
              charges: processedCharges.map((charge: any) => ({
                charge_name: charge.charge_name,
                currency: charge.currency,
                unit: charge.unit,
                quantity: charge.quantity,
                rate: charge.rate,
              })),
            };

            setCharges([formattedChargesData]);

            // Update the actual selected carrier and form
            if (tempSelectedCarrier) {
              setSelectedCarrierCode(tempSelectedCarrier.carrier_code);
              quotationForm.setFieldValue(
                "carrier_code",
                tempSelectedCarrier.carrier_code,
              );
              setTempSelectedCarrier(null);
            }

            break;
          }

          case "as_per_tariff": {
            const response = await getCharges(
              "as-per-tariff",
              enquiryID,
              carrierVal,
              service,
              icdVal,
              currentServiceId,
            );
            console.log("Charges----", response);
            const tariffResponse = response as ChargesDataItem;
            setCharges((prev) => [...prev, tariffResponse]);

            // Update the actual selected carrier and form
            if (tempSelectedCarrier) {
              setSelectedCarrierCode(tempSelectedCarrier.carrier_code);
              quotationForm.setFieldValue(
                "carrier_code",
                tempSelectedCarrier.carrier_code,
              );
              setTempSelectedCarrier(null);
            }

            break;
          }

          default:
            console.log("Unknown call mode");
        }
      } catch (error) {
        console.error("Error in tariff submission:", error);
        ToastNotification({
          type: "error",
          message: "Failed to submit tariff. Please try again.",
        });
      } finally {
        setIsSubmittingTariff(false);
      }
    }
  };

  // Show loading only when essential data is loading
  // For edit mode: only need carrier and currency data
  // For create mode: need all data including destination
  const shouldShowLoading =
    isCarrierLoading || isCurrencyLoading || isLoadingQuotationData;

  if (shouldShowLoading) {
    return (
      <Stack
        p="xl"
        align="center"
        justify="center"
        style={{ minHeight: "80vh" }}
      >
        <Stack align="center" gap="xs">
          <Loader size="xl" color="#105476" />
          <Text size="xl" color="dimmed">
            {isLoadingQuotationData
              ? "Loading quotation details..."
              : "Loading quotation form..."}
          </Text>
        </Stack>
      </Stack>
    );
  }

  // if (isTariffProcessing) {
  //   return (
  //     <Group justify="center" mt="md">
  //       <Loader color="blue" />
  //     </Group>
  //   );
  // }

  return (
    <Box
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Box
        p="sm"
        mx="auto"
        style={{
          backgroundColor: "#F8F8F8",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Only render left pane when standalone (no goToStep prop) */}
        {/* Always show layout with fixed footer for edit mode or when embedded in EnquiryCreate (goToStep exists) */}
        {(() => {
          // Show the main two-pane layout for edit mode, embedded-in-enquiry mode, **and** view mode
          const shouldShowLayout =
            isEditMode || goToStep || isViewMode || isDirectQuoteFromList;
          console.log("QuotationCreate Layout Debug:", {
            isEditMode,
            goToStep: !!goToStep,
            actionType: enquiryData?.actionType,
            shouldShowLayout,
            isStandaloneEdit,
            isEmbeddedEditMode,
          });
          return shouldShowLayout;
        })() ? (
          <Flex
            gap="md"
            align="flex-start"
            style={{ height: "calc(100vh - 112px)", width: "100%" }}
          >
            {/* Left Pane - Stepper Titles - Show for edit mode without goToStep or when goToStep exists (embedded in EnquiryCreate) */}
            {(() => {
              const shouldShowLeftPane =
                ((isEditMode && !goToStep) || goToStep) && !isDirectQuoteFromList;
              console.log("QuotationCreate Left Pane Debug:", {
                isEditMode,
                goToStep: !!goToStep,
                shouldShowLeftPane,
                condition1: isEditMode && !goToStep,
                condition2: !!goToStep,
              });
              return shouldShowLeftPane;
            })() && (
              <Box
                style={{
                  minWidth: 180,
                  width: "100%",
                  maxWidth: 220,
                  height: "100%",
                  alignSelf: "stretch",
                  borderRadius: "8px",
                  backgroundColor: "#FFFFFF",
                  position: "sticky",
                  top: 0,
                  zIndex: auditInfoHovered
                    ? EDIT_PAGE_AUDIT_SIDEBAR_Z_INDEX.hovered
                    : EDIT_PAGE_AUDIT_SIDEBAR_Z_INDEX.default,
                  overflow: "visible",
                }}
              >
                <Box
                  style={{
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                  }}
                >
                  <Group gap={6} justify="center" wrap="nowrap">
                    <Text
                      size="md"
                      fw={600}
                      c="#105476"
                      style={{
                        fontFamily: "Inter",
                        fontStyle: "medium",
                        fontSize: "16px",
                        color: "#105476",
                        textAlign: "center",
                      }}
                    >
                      {isEditMode ? "Edit Quotation" : "Create Quotation"}
                    </Text>
                    <EditPageAuditInfoIcon
                      visible={isEditMode || isViewMode}
                      auditInfo={quotationAuditInfo}
                      animateKey={
                        quotationIdForEdit || quotationId || quotationData?.id
                      }
                      ariaLabel="Quotation audit info"
                      onHoverChange={setAuditInfoHovered}
                    />
                  </Group>
                </Box>
                <Stack gap="sm" style={{ height: "100%", padding: "10px" }}>
                  {/* Step 1: Customer Details - Completed */}
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log("Step 1 clicked - navigating to step 0");
                      if (goToStep && typeof goToStep === "function") {
                        // Navigate to customer details step (step 0) in enquiry-create flow
                        goToStep(0);
                      } else if (isEmbeddedEditMode) {
                        // If embedded but goToStep not available, navigate to enquiry-create
                        navigateToEnquiryStep(0);
                      } else if (isStandaloneEdit) {
                        // For standalone edit, navigate to enquiry-create step 0
                        navigateToEnquiryStep(0);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.2s",
                    }}
                  >
                    <Flex
                      align="center"
                      gap="sm"
                      style={{ pointerEvents: "none" }}
                    >
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: "#EAF9F1",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: 600,
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        <IconCircleCheck
                          size={20}
                          color="#289D69"
                          fill="#EAF9F1"
                        />
                      </Box>
                      <Text
                        size="sm"
                        fw={400}
                        c="#105476"
                        style={{
                          lineHeight: 1.3,
                          fontFamily: "Inter",
                          fontStyle: "regular",
                          fontSize: "13px",
                          color: "#105476",
                        }}
                      >
                        Customer Details
                      </Text>
                    </Flex>
                  </Box>

                  {/* Vertical dotted line connector */}
                  <Box
                    style={{
                      height: "24px",
                      width: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: "0",
                      position: "relative",
                    }}
                  >
                    <Box
                      style={{
                        width: "2px",
                        height: "100%",
                        borderLeft: "2px dotted #d1d5db",
                      }}
                    />
                  </Box>

                  {/* Step 2: Service & Cargo Details - Completed */}
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log(
                        "Step 2 clicked - navigating to step 1, goToStep:",
                        goToStep,
                        "isEmbeddedEditMode:",
                        isEmbeddedEditMode,
                        "isStandaloneEdit:",
                        isStandaloneEdit,
                      );
                      if (goToStep && typeof goToStep === "function") {
                        // Navigate to service details step (step 1) in enquiry-create flow
                        console.log("Calling goToStep(1)");
                        goToStep(1);
                      } else if (isEmbeddedEditMode) {
                        // If embedded but goToStep not available, navigate to enquiry-create
                        console.log(
                          "Embedded mode but goToStep missing, navigating to enquiry-create step 1",
                        );
                        navigateToEnquiryStep(1);
                      } else if (isStandaloneEdit) {
                        // For standalone edit, navigate to enquiry-create step 1
                        console.log("Calling navigateToEnquiryStep(1)");
                        navigateToEnquiryStep(1);
                      } else {
                        console.log("No navigation method available");
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.2s",
                    }}
                  >
                    <Flex
                      align="center"
                      gap="sm"
                      style={{ pointerEvents: "none" }}
                    >
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: "#EAF9F1",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: 600,
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        <IconCircleCheck
                          size={20}
                          color="#289D69"
                          fill="#EAF9F1"
                        />
                      </Box>
                      <Text
                        size="sm"
                        fw={400}
                        c="#374151"
                        style={{
                          lineHeight: 1.3,
                          fontFamily: "Inter",
                          fontStyle: "regular",
                          fontSize: "13px",
                          color: "#105476",
                        }}
                      >
                        Service & Cargo Details
                      </Text>
                    </Flex>
                  </Box>

                  {/* Vertical dotted line connector */}
                  <Box
                    style={{
                      height: "24px",
                      width: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: "0",
                      position: "relative",
                    }}
                  >
                    <Box
                      style={{
                        width: "2px",
                        height: "100%",
                        borderLeft: "2px dotted #d1d5db",
                      }}
                    />
                  </Box>

                  {/* Step 3: Quotation - Active */}
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log("Step 3 clicked - navigating to step 2");
                      if (goToStep && typeof goToStep === "function") {
                        // Navigate to quotation step (step 2) in enquiry-create flow
                        goToStep(2);
                      } else if (isEmbeddedEditMode) {
                        // If embedded but goToStep not available, navigate to enquiry-create
                        navigateToEnquiryStep(2);
                      } else if (isStandaloneEdit) {
                        // For standalone edit, navigate to enquiry-create step 2
                        navigateToEnquiryStep(2);
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.2s",
                    }}
                  >
                    <Flex
                      align="center"
                      gap="sm"
                      style={{ pointerEvents: "none" }}
                    >
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: "#fff",
                          border: "2px solid #105476",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: 600,
                          color: "#105476",
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        <IconFileText
                          size={20}
                          color="#105476"
                          fill="#E6F2F8"
                        />
                      </Box>
                      <Text
                        size="sm"
                        fw={400}
                        c="#374151"
                        style={{
                          lineHeight: 1.3,
                          fontFamily: "Inter",
                          fontStyle: "regular",
                          fontSize: "13px",
                          color: "#105476",
                        }}
                      >
                        Quotation
                      </Text>
                    </Flex>
                  </Box>
                </Stack>
              </Box>
            )}

            {/* Right Pane - Quotation Form */}
            <Box
              style={{
                flex: 1,
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                height: "calc(100vh - 100px)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {isDirectQuoteFromList && (
                <Text
                  size="md"
                  fw={600}
                  c="#105476"
                  px="md"
                  py="sm"
                  style={{
                    fontFamily: "Inter",
                    borderBottom: "1px solid #e9ecef",
                    flexShrink: 0,
                  }}
                >
                  Create Quotation
                </Text>
              )}
              <Box
                style={{
                  flex: 1,
                  overflowY: "auto",
                  paddingBottom: "16px",
                  backgroundColor: "#F8F8F8",
                  minHeight: 0,
                }}
              >
                {isDirectQuoteFromList && (
                  <Box
                    ref={enquirySectionRef}
                    style={{
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <DirectQuoteEnquiryFields
                      onEnquiryDataSync={handleInlineEnquirySync}
                      validateEnquiryRef={validateEnquiryRef}
                    />
                  </Box>
                )}
                <Box
                  style={{
                    backgroundColor: "#FFFFFF",
                    padding: isDirectQuoteFromList ? "8px 24px 24px" : "24px",
                  }}
                >
                  <Box>
                      {isDirectQuoteFromList && (
                        <Text
                          fw={600}
                          c="#105476"
                          mb="sm"
                          size="sm"
                          style={{ fontFamily: "Inter" }}
                        >
                          Quotation Details
                        </Text>
                      )}
                      {/* Service Details Slider */}
                      {services.length > 0 && (
                        <ServiceDetailsSlider
                          services={services}
                          selectedServiceIndex={selectedServiceIndex}
                          onServiceSelect={handleServiceSelect}
                          hideTitle={isDirectQuoteFromList}
                        />
                      )}

                      {/* Tariff Submission Loading Overlay */}
                      {isSubmittingTariff && (
                    <Box
                      style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                      }}
                    >
                      <Stack align="center" gap="md">
                        <Loader size="xl" color="#105476" />
                        <Text
                          size="lg"
                          color="white"
                          fw={500}
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Getting tariff chargers...
                        </Text>
                      </Stack>
                    </Box>
                  )}

                      {/* Quotation Form */}
                      <Grid mb={30} key={`quotation-form-${currentServiceId}`}>
                    <Grid.Col span={1.75}>
                      <Dropdown
                        key={`${currentServiceId}-quote-currency`}
                        label="Quote Currency"
                        searchable
                        placeholder="Select currency"
                        data={quoteCurrency}
                        styles={{
                          input: {
                            fontSize: "14px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                          label: {
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "#424242",
                            marginBottom: "4px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        {...quotationForm.getInputProps(
                          "quote_currency_country_code",
                        )}
                        readOnly={isViewMode}
                        disabled={isViewMode}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.75}>
                      <Box maw={300} mx="auto">
                        <SingleDateInput
                          label="Date"
                          key={`${currentServiceId}-valid-upto`}
                          placeholder="YYYY-MM-DD"
                          value={
                            quotationForm.values.valid_upto
                              ? new Date(quotationForm.values.valid_upto)
                              : null
                          }
                          onChange={(date) => {
                            if (!isViewMode) {
                              const formatted = date
                                ? dayjs(date).format("YYYY-MM-DD")
                                : "";
                              quotationForm.setFieldValue(
                                "valid_upto",
                                formatted,
                              );
                            }
                          }}
                          valueFormat="YYYY-MM-DD"
                          leftSection={<IconCalendar size={18} />}
                          leftSectionPointerEvents="none"
                          radius="sm"
                          size="sm"
                          readOnly={isViewMode}
                          disabled={isViewMode}
                          // dropdownType="popover"
                          error={quotationForm.errors.valid_upto}
                        />
                      </Box>
                    </Grid.Col>
                    <Grid.Col span={1.25}>
                      <Checkbox
                        key={`${currentServiceId}-multi-carrier`}
                        label="Multi Carrier"
                        checked={quotationForm.values.multi_carrier === "true"}
                        onChange={(event) => {
                          if (!isViewMode) {
                            quotationForm.setFieldValue(
                              "multi_carrier",
                              event.currentTarget.checked ? "true" : "false",
                            );
                          }
                        }}
                        disabled={isViewMode}
                        styles={{
                          label: {
                            fontSize: "14px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                            color: "#424242",
                            fontWeight: 500,
                          },
                          input: {
                            cursor: "pointer",
                          },
                        }}
                        mt={28}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.25}>
                      <Dropdown
                        label="Quote Type"
                        searchable
                        key={quotationForm.key("quote_type")}
                        placeholder="Enter Quote Type"
                        data={["Standard", "Lumpsum", "All Inclusive"]}
                        styles={{
                          input: {
                            fontSize: "14px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                          label: {
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "#424242",
                            marginBottom: "4px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        {...quotationForm.getInputProps("quote_type")}
                        readOnly={isViewMode}
                        disabled={isViewMode}
                      />
                    </Grid.Col>
                    {selectedService?.service !== "LCL" && (
                      <Grid.Col span={1.25}>
                        <SearchableSelect
                          label="Carrier"
                          placeholder="Type carrier name"
                          apiEndpoint={URL.carrier}
                          searchFields={["carrier_code", "carrier_name"]}
                          displayFormat={carrierDisplayFormat}
                          value={quotationForm.values.carrier_code || null}
                          displayValue={formatCarrierDisplayValue(
                            carrierData.find(
                              (c) =>
                                c.value === quotationForm.values.carrier_code,
                            )?.label,
                            quotationForm.values.carrier_code,
                          )}
                          onChange={(value) => {
                            quotationForm.setFieldValue(
                              "carrier_code",
                              value || "",
                            );
                            if (!value) {
                              setSelectedCarrierCode("");
                              setTempSelectedCarrier(null);
                            }
                          }}
                          minSearchLength={2}
                          dropdownZIndex={10}
                          styles={{
                            input: {
                              fontSize: "14px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                            label: {
                              fontSize: "14px",
                              fontWeight: 500,
                              color: "#424242",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          error={
                            quotationForm.errors.carrier_code as
                              | string
                              | undefined
                          }
                          additionalParams={carrierTransportModeParams}
                          readOnly={isViewMode}
                          disabled={isViewMode}
                        />
                      </Grid.Col>
                    )}
                    <Grid.Col span={1.65}>
                      <Dropdown
                        label="Status"
                        placeholder="Select Status"
                        searchable
                        data={[
                          { value: "QUOTE CREATED", label: "Quote Created" },
                          { value: "GAINED", label: "Gained" },
                          { value: "LOST", label: "Lost" },
                        ]}
                        styles={{
                          input: {
                            fontSize: "14px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                          label: {
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "#424242",
                            marginBottom: "4px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        {...quotationForm.getInputProps("status")}
                        readOnly={isViewMode}
                        disabled={isViewMode}
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Flex gap="sm" align="flex-end">
                        <div style={{ flex: 1 }}>
                          <RemarkInputWithTooltip
                            value={quotationForm.values.remark}
                            error={
                              quotationForm.errors.remark
                                ? String(quotationForm.errors.remark)
                                : undefined
                            }
                            isRemarkRequired={isRemarkRequired}
                            isViewMode={isViewMode}
                            onChange={(formattedValue) =>
                              quotationForm.setFieldValue(
                                "remark",
                                formattedValue,
                              )
                            }
                          />
                        </div>
                        {!isViewMode && (
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
                                    <IconNotes size={16} color="#105476" />
                                  </Box>
                                }
                                styles={{
                                  item: {
                                    fontFamily: "Inter",
                                    fontSize: "14px",
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
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "#424242",
                                  },
                                }}
                                onClick={handleOpenNotesConditionsModal}
                              >
                                Notes & Conditions
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
                                    <IconChartBar size={16} color="#105476" />
                                  </Box>
                                }
                                disabled={selectedService?.service === "LCL"}
                                styles={{
                                  item: {
                                    fontFamily: "Inter",
                                    fontSize: "14px",
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
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "#424242",
                                  },
                                }}
                                onClick={() => {
                                  if (!carrierComparisonData) {
                                    fetchCarrierComparison();
                                  }
                                  openCarrierModal();
                                }}
                              >
                                Check carrier comparison
                              </Menu.Item>
                              {!isViewMode && (
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
                                      <IconDatabase size={16} color="#105476" />
                                    </Box>
                                  }
                                  disabled={
                                    selectedService?.service === "FCL" &&
                                    !quotationForm.values.carrier_code
                                  }
                                  styles={{
                                    item: {
                                      fontFamily: "Inter",
                                      fontSize: "14px",
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
                                      fontSize: "14px",
                                      fontWeight: 500,
                                      color: "#424242",
                                    },
                                  }}
                                  onClick={() => open()}
                                >
                                  Get tariff data
                                </Menu.Item>
                              )}
                              {isStandaloneEdit && (
                                <>
                                  <Menu.Divider />
                                  {actualEnquiryData?.status === "GAINED" && (
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
                                          <IconBook size={16} color="#105476" />
                                        </Box>
                                      }
                                      styles={{
                                        item: {
                                          fontFamily: "Inter",
                                          fontSize: "14px",
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
                                        handleCreateBooking();
                                      }}
                                    >
                                      Create Booking
                                    </Menu.Item>
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
                                        <IconHistory
                                          size={16}
                                          color="#105476"
                                        />
                                      </Box>
                                    }
                                    styles={{
                                      item: {
                                        fontFamily: "Inter",
                                        fontSize: "14px",
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
                                    onClick={fetchChargeHistory}
                                  >
                                    Check charge history
                                  </Menu.Item>
                                </>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        )}
                      </Flex>
                    </Grid.Col>
                  </Grid>

                  {/* Dynamic Charges */}
                  <Stack
                    justify="lg"
                    key={`dynamic-form-${currentServiceId}`}
                    px={0}
                  >
                    {dynamicForm.values.charges.length > 0 && (
                      <Grid
                        // mt="md"
                        // mb="xs"
                        style={{
                          fontWeight: 600,
                          color: "#105476",
                        }}
                        gutter="sm"
                      >
                        <Grid.Col span={2}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            Charge Name
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            Currency
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={0.75}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            ROE
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            Unit
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={0.75}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            No of Units
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            Sell Per Unit
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            Min Sell
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            Cost Per Unit
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            Total Sell
                            {branchCurrencyCode ? ` (${branchCurrencyCode})` : ""}
                          </Text>
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Text
                            style={{
                              fontFamily: "Inter",
                              fontSize: "14px",
                              fontWeight: 700,
                              color: "#000000",
                            }}
                          >
                            Total Cost
                            {branchCurrencyCode ? ` (${branchCurrencyCode})` : ""}
                          </Text>
                        </Grid.Col>
                      </Grid>
                    )}
                    {dynamicForm.values.charges.map((_, index) => (
                      <Box
                        key={index}
                        // style={{
                        //   border: "1px solid #eee",
                        //   borderRadius: 8,
                        //   boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                        // }}
                        // p="lg"
                        // mt={"md"}
                      >
                        <Grid gutter="sm">
                          <Grid.Col span={2}>
                            {dynamicForm.values.charges[index]?.charge_id !=
                            null ? (
                              <TextInput
                                placeholder="Charge Name"
                                styles={{
                                  input: {
                                    fontSize: "14px",
                                    fontFamily: "Inter",
                                    height: "36px",
                                  },
                                }}
                                {...dynamicForm.getInputProps(
                                  `charges.${index}.charge_name`,
                                )}
                                readOnly={isViewMode}
                                disabled={isViewMode}
                                rightSection={
                                  isViewMode ? null : (
                                    <ActionIcon
                                      variant="subtle"
                                      color="gray"
                                      onClick={() => {
                                        dynamicForm.setFieldValue(
                                          `charges.${index}.charge_name`,
                                          "",
                                        );
                                        dynamicForm.setFieldValue(
                                          `charges.${index}.charge_id`,
                                          null,
                                        );
                                      }}
                                      aria-label="Clear charge name"
                                    >
                                      <Text
                                        style={{
                                          fontSize: 18,
                                          lineHeight: 1,
                                          fontWeight: 700,
                                        }}
                                      >
                                        ×
                                      </Text>
                                    </ActionIcon>
                                  )
                                }
                              />
                            ) : (
                              <SearchableSelect
                                placeholder="Charge Name"
                                apiEndpoint={URL.chargeMaster}
                                dropdownZIndex={310}
                                searchFields={["charge_code", "charge_name"]}
                                displayFormat={(
                                  item: Record<string, unknown>,
                                ) => {
                                  const charge = item as {
                                    id?: number;
                                    charge_name?: string;
                                  };
                                  const name = charge.charge_name || "";
                                  return {
                                    value: String(charge.id ?? ""),
                                    label: name,
                                  };
                                }}
                                value={
                                  dynamicForm.values.charges[index]
                                    ?.charge_id != null
                                    ? String(
                                        dynamicForm.values.charges[index]
                                          .charge_id,
                                      )
                                    : null
                                }
                                displayValue={
                                  dynamicForm.values.charges[index]
                                    ?.charge_name || ""
                                }
                                onChange={(value, selected, originalData) => {
                                  if (isViewMode) return;
                                  const original = (originalData || {}) as {
                                    id?: number;
                                    charge_name?: string;
                                  };
                                  const name =
                                    original.charge_name !== undefined &&
                                    original.charge_name !== null
                                      ? original.charge_name
                                      : selected?.label
                                        ? selected.label.split(" (")[0]
                                        : "";
                                  dynamicForm.setFieldValue(
                                    `charges.${index}.charge_name`,
                                    name,
                                  );
                                  if (original.id != null) {
                                    dynamicForm.setFieldValue(
                                      `charges.${index}.charge_id`,
                                      original.id,
                                    );
                                  } else if (value) {
                                    dynamicForm.setFieldValue(
                                      `charges.${index}.charge_id`,
                                      Number(value),
                                    );
                                  } else {
                                    dynamicForm.setFieldValue(
                                      `charges.${index}.charge_id`,
                                      null,
                                    );
                                  }
                                }}
                                readOnly={isViewMode}
                                disabled={isViewMode}
                                error={
                                  (dynamicForm.errors as any)?.charges?.[index]
                                    ?.charge_name as string | undefined
                                }
                                returnOriginalData
                                styles={{
                                  input: {
                                    fontSize: "14px",
                                    fontFamily: "Inter",
                                    height: "36px",
                                  },
                                }}
                              />
                            )}
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <Dropdown
                              placeholder="Select Currency"
                              searchable
                              key={
                                // dynamicForm.values.charges[index]?.currency_country_code ||
                                `unit-${index}-currency_country_code`
                              }
                              data={currency}
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.currency_country_code`,
                              )}
                              onChange={(value) => {
                                if (!isViewMode) {
                                  handleChargeCurrencyChange(
                                    index,
                                    value || "",
                                  );
                                }
                              }}
                              readOnly={isViewMode}
                              disabled={isViewMode}
                            />
                          </Grid.Col>
                          <Grid.Col span={0.75}>
                            <TextInput
                              key={
                                // dynamicForm.values.charges[index]?.roe ||
                                `unit-${index}-roe`
                              }
                              min={1}
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...bindChargeAmountInput(index, "roe")}
                              readOnly={
                                isViewMode ||
                                isBaseCurrency(
                                  dynamicForm.values.charges[index]
                                    ?.currency_country_code,
                                )
                              }
                              disabled={
                                isViewMode ||
                                isBaseCurrency(
                                  dynamicForm.values.charges[index]
                                    ?.currency_country_code,
                                )
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <Dropdown
                              searchable
                              placeholder="Select Unit"
                              data={unitData}
                              key={
                                // dynamicForm.values.charges[index]?.unit ||
                                `unit-${index}-no_of_units`
                              }
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.unit`,
                              )}
                              onChange={(value) => {
                                if (!isViewMode) {
                                  applyChargeUnitSelection(index, value);
                                }
                              }}
                              onOptionSubmit={(value) => {
                                if (!isViewMode) {
                                  applyChargeUnitSelection(index, value);
                                }
                              }}
                              disabled={isViewMode || isLoadingUnitData}
                              readOnly={isViewMode}
                            />
                          </Grid.Col>
                          <Grid.Col span={0.75}>
                            <TextInput
                              key={`unit-${index}-no_of_units`}
                              //placeholder={"100"}
                              min={1}
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...bindChargeAmountInput(index, "no_of_units")}
                              readOnly={isViewMode}
                              disabled={
                                isViewMode ||
                                dynamicForm.values.charges[index]?.toBeDisabled
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <FormNumberInput
                              key={`unit-${index}-sell_per_unit`}
                              min={0}
                              hideControls
                              decimalScale={currencyAmountDecimalScale}
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...bindChargeMoneyField(index, "sell_per_unit")}
                              readOnly={isViewMode}
                              disabled={isViewMode}
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <FormNumberInput
                              key={`unit-${index}-min_sell`}
                              disabled={
                                isViewMode ||
                                dynamicForm.values.charges[index]?.toBeDisabled
                              }
                              readOnly={isViewMode}
                              min={0}
                              hideControls
                              decimalScale={currencyAmountDecimalScale}
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...bindChargeMoneyField(index, "min_sell")}
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <FormNumberInput
                              key={`unit-${index}-cost_per_unit`}
                              disabled={
                                isViewMode ||
                                dynamicForm.values.charges[index]?.toBeDisabled
                              }
                              readOnly={isViewMode}
                              min={0}
                              hideControls
                              decimalScale={currencyAmountDecimalScale}
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...bindChargeMoneyField(index, "cost_per_unit")}
                            />
                          </Grid.Col>
                          {/* <Grid.Col span={1}>
                <TextInput
                  key={
                    dynamicForm.values.charges[index]?.min_cost ||
                    `unit-${index}-min_cost`
                  }
                  disabled={
                    isViewMode || dynamicForm.values.charges[index]?.toBeDisabled
                  }
                  readOnly={isViewMode}
                  //placeholder={"100"}
                  min={1}
                  {...dynamicForm.getInputProps(`charges.${index}.min_cost`)}
                />
              </Grid.Col> */}
                          {/* {quotationForm.values.carrier_code &&
                tariffOption.values.tariffVal === "as_per_tariff" && (
                  <> */}
                          {/* <Grid.Col span={1}>
                      <TextInput
                        key={`unit-${index}-total_cost`}
                        type="number"
                        min={1}
                        {...dynamicForm.getInputProps(
                          `charges.${index}.total_cost`
                        )}
                        readOnly={isViewMode}
                        disabled={isViewMode}
                        styles={{
                          input: {
                            // Remove number arrows (spinner)
                            MozAppearance: "textfield",
                            WebkitAppearance: "none",
                            appearance: "none",
                          },
                        }}
                      />
                    </Grid.Col>

                    <Grid.Col span={1}>
                      <TextInput
                        key={`unit-${index}-total_sell`}
                        type="number"
                        min={1}
                        {...dynamicForm.getInputProps(
                          `charges.${index}.total_sell`
                        )}
                        readOnly={isViewMode}
                        disabled={isViewMode}
                        styles={{
                          input: {
                            MozAppearance: "textfield",
                            WebkitAppearance: "none",
                            appearance: "none",
                          },
                        }}
                      />
                    </Grid.Col> */}
                          <Grid.Col span={1}>
                            <FormNumberInput
                              key={`unit-${index}-total_sell`}
                              value={moneyFormValueToNumber(
                                dynamicForm.values.charges[index]?.total_sell ??
                                  formatMoneyAmountBound(0),
                              )}
                              decimalScale={localAmountDecimalScale}
                              groupThousands
                              hideControls
                              readOnly
                              disabled={isViewMode}
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                  backgroundColor: isViewMode
                                    ? "#ffffff"
                                    : "#f8f9fa",
                                  cursor: isViewMode
                                    ? "default"
                                    : "not-allowed",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <FormNumberInput
                              key={`unit-${index}-total_cost`}
                              value={moneyFormValueToNumber(
                                dynamicForm.values.charges[index]?.total_cost ??
                                  formatMoneyAmountBound(0),
                              )}
                              decimalScale={localAmountDecimalScale}
                              groupThousands
                              hideControls
                              readOnly
                              disabled={isViewMode}
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                  backgroundColor: isViewMode
                                    ? "#ffffff"
                                    : "#f8f9fa",
                                  cursor: isViewMode
                                    ? "default"
                                    : "not-allowed",
                                },
                              }}
                            />
                          </Grid.Col>

                          {/* </>
                )} */}

                          {dynamicForm.values.charges.length - 1 === index &&
                            !isViewMode && (
                              <Grid.Col span={0.75}>
                                <Button
                                  radius={"sm"}
                                  variant="light"
                                  color="#105476"
                                  onClick={() =>
                                    dynamicForm.insertListItem("charges", {
                                      charge_name: "",
                                      charge_id: null,
                                      ...getDefaultNewChargeFields(),
                                      unit: "",
                                      no_of_units: "",
                                      sell_per_unit: "",
                                      min_sell: "",
                                      cost_per_unit: "",
                                      total_cost: "",
                                      total_sell: "",
                                      // min_cost: "",
                                    })
                                  }
                                >
                                  <IconPlus size={16} />
                                </Button>
                              </Grid.Col>
                            )}
                          {!isViewMode && (
                            <Grid.Col span={0.75}>
                              {dynamicForm.values.charges.length > 1 ? (
                                <Button
                                  variant="light"
                                  color="red"
                                  onClick={() =>
                                    dynamicForm.removeListItem("charges", index)
                                  }
                                >
                                  <IconTrash size={16} />
                                </Button>
                              ) : (
                                ""
                              )}
                            </Grid.Col>
                          )}
                      </Grid>
                      </Box>
                    ))}

                    <Grid
                      // mt="xs"
                      // justify="flex-end"
                      style={{
                        fontWeight: 600,
                        color: "#105476",
                        // borderTop: "1px solid #ccc",
                        paddingTop: "0.5rem",
                      }}
                    >
                      <Grid.Col span={7.5} />
                      <Grid.Col span={1} ml={10}>
                        {" "}
                        Total:
                      </Grid.Col>
                      <Grid.Col span={1}>{formatMoneyDisplay(netSell)}</Grid.Col>
                      <Grid.Col span={1}> {formatMoneyDisplay(netCost)}</Grid.Col>
                    </Grid>
                    <Grid
                      mt={8}
                      style={{
                        fontWeight: 600,
                        color: profit >= 0 ? "green" : "red",
                      }}
                    >
                      <Grid.Col span={7.5} />

                      <Grid.Col span={1} ml={10}>
                        Profit
                        {branchCurrencyCode ? ` (${branchCurrencyCode})` : ""}=
                      </Grid.Col>
                      <Grid.Col span={1}> {formatMoneyDisplay(profit)}</Grid.Col>
                    </Grid>
                    {showQuoteCurrencyProfit && (
                      <Grid
                        mt={4}
                        style={{
                          fontWeight: 600,
                          color: profitInQuoteCurrency >= 0 ? "green" : "red",
                        }}
                      >
                        <Grid.Col span={7.5} />
                        <Grid.Col span={1} ml={10}>
                          Profit ({normalizedQuoteCurrency})=
                        </Grid.Col>
                        <Grid.Col span={1}>
                          {" "}
                          {formatMoneyAmountForUi(profitInQuoteCurrency, false)}
                        </Grid.Col>
                      </Grid>
                    )}
                  </Stack>
                    </Box>
                </Box>
              </Box>

              {/* Footer - Fixed at bottom of right pane */}
              <Box
                style={{
                  borderTop: "1px solid #e9ecef",
                  padding: "20px 32px",
                  backgroundColor: "#ffffff",
                  flexShrink: 0,
                }}
              >
                <Group justify="space-between">
                  <Group>
                    <Button
                      variant="outline"
                      color="#000"
                      onClick={() => {
                        if (goToStep && typeof goToStep === "function") {
                          // Navigate back to enquiry form (stepper 2 - service details)
                          goToStep(1);
                        } else if (
                          location.state?.returnTo === "dashboard-pipeline"
                        ) {
                          // Navigate back to dashboard (Pipeline Report tab) when from pipeline report
                          navigate("/", {
                            state: {
                              returnToPipelineReport: true,
                              pipelineReportState:
                                location.state?.pipelineReportState,
                            },
                          });
                        } else if (location.state?.returnTo === "dashboard") {
                          // Navigate back to dashboard (Enquiry detailed view) when from enquiry conversion
                          navigate("/", {
                            state: {
                              returnToEnquiryDetailedView: true,
                              dashboardState: location.state?.returnToState,
                            },
                          });
                        } else if (
                          isStandaloneEdit &&
                          (actualEnquiryData?.enquiry_id ||
                            quotationData?.enquiry_id ||
                            fetchedQuotationData?.enquiry_id)
                        ) {
                          // Navigate to enquiry form step 0 (Customer Details)
                          navigateToEnquiryStep(0);
                        } else if (location.state?.fromEnquiry) {
                          // Navigate back to enquiry page with preserved filters
                          const preserveFilters =
                            location.state?.preserveFilters;
                          if (preserveFilters) {
                            navigate("/enquiry", {
                              state: {
                                restoreFilters: preserveFilters,
                                refreshData: true,
                              },
                            });
                          } else {
                            navigate("/enquiry", {
                              state: { refreshData: true },
                            });
                          }
                        } else if (location.state?.returnTo === "call-entry") {
                          // Navigate back to call-entry with the drawer open
                          navigate("/call-entry-create", {
                            state: location.state.returnToState,
                          });
                        } else {
                          // Default: navigate back to originating list (quotation or approval)
                          navigateToPreferredList(
                            location.state?.preserveFilters,
                          );
                        }
                      }}
                    >
                      {isViewMode ? "Back to Dashboard" : "Back"}
                    </Button>
                    {/* Show Clear all for createQuote flow */}
                    {goToStep && enquiryData?.actionType === "createQuote" && (
                      <Button
                        variant="outline"
                        color="gray"
                        size="sm"
                        styles={{
                          root: {
                            borderColor: "#d0d0d0",
                            color: "#666",
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        onClick={() => {
                          resetFormsToDefaults();
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                    {/* Show Clear all for standalone edit mode */}
                    {isStandaloneEdit && !goToStep && (
                      <Button
                        variant="outline"
                        color="gray"
                        size="sm"
                        styles={{
                          root: {
                            borderColor: "#d0d0d0",
                            color: "#666",
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        onClick={() => {
                          resetFormsToDefaults();
                        }}
                      >
                        Clear all
                      </Button>
                    )}
                    {isDirectQuoteFromList && (
                      <Button
                        variant="outline"
                        color="gray"
                        size="sm"
                        styles={{
                          root: {
                            borderColor: "#d0d0d0",
                            color: "#666",
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        onClick={() => {
                          const preserveFilters =
                            location.state?.preserveFilters;
                          if (preserveFilters) {
                            navigate("/quotation", {
                              state: {
                                restoreFilters: preserveFilters,
                                refreshData: true,
                              },
                            });
                          } else {
                            navigate("/quotation", {
                              state: { refreshData: true },
                            });
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    {/* Show Cancel for createQuote flow */}
                    {goToStep && enquiryData?.actionType === "createQuote" && (
                      <Button
                        variant="outline"
                        color="gray"
                        size="sm"
                        styles={{
                          root: {
                            borderColor: "#d0d0d0",
                            color: "#666",
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        onClick={() => {
                          // Navigate back to quotation list
                          const preserveFilters =
                            location.state?.preserveFilters;
                          if (preserveFilters) {
                            navigate("/quotation", {
                              state: {
                                restoreFilters: preserveFilters,
                                refreshData: true,
                              },
                            });
                          } else {
                            navigate("/quotation", {
                              state: { refreshData: true },
                            });
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </Group>
                  {!isViewMode && (
                    <Group>
                      <Button
                        rightSection={
                          isSubmittingQuotation ? (
                            <Loader size={16} color="white" />
                          ) : (
                            <IconCheck size={16} />
                          )
                        }
                        onClick={() => quotationSubmit()}
                        color="teal"
                        disabled={isSubmittingQuotation}
                      >
                        {isSubmittingQuotation
                          ? isStandaloneEdit
                            ? "Updating..."
                            : "Submitting..."
                          : isStandaloneEdit
                            ? "Update"
                            : "Submit"}
                      </Button>
                    </Group>
                  )}
                </Group>
              </Box>
            </Box>
          </Flex>
        ) : (
          <Box
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {/* Scrollable Content Area */}
            <Box
              style={{
                flex: 1,
                overflowY: "auto",
                paddingBottom: "16px",
                backgroundColor: "#F8F8F8",
                minHeight: 0,
              }}
            >
              {/* Service Details Slider */}
              {services.length > 0 && (
                <ServiceDetailsSlider
                  services={services}
                  selectedServiceIndex={selectedServiceIndex}
                  onServiceSelect={handleServiceSelect}
                />
              )}

              {/* Tariff Submission Loading Overlay */}
              {isSubmittingTariff && (
                <Box
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                  }}
                >
                  <Stack align="center" gap="md">
                    <Loader size="xl" color="#105476" />
                    <Text
                      size="lg"
                      color="white"
                      fw={500}
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      Getting tariff chargers...
                    </Text>
                  </Stack>
                </Box>
              )}

              {/* Quotation Form */}
              <Box style={{ backgroundColor: "#FFFFFF", padding: "24px" }}>
                <Grid mb={30} key={`quotation-form-${currentServiceId}`}>
                  <Grid.Col span={1.75}>
                    <Dropdown
                      key={`${currentServiceId}-quote-currency`}
                      label="Quote Currency"
                      searchable
                      placeholder="Select currency"
                      data={quoteCurrency}
                      styles={{
                        input: {
                          fontSize: "14px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                        label: {
                          fontSize: "16px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                      }}
                      {...quotationForm.getInputProps(
                        "quote_currency_country_code",
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.75}>
                    <Box maw={300} mx="auto">
                      <SingleDateInput
                        label="Date"
                        key={`${currentServiceId}-valid-upto`}
                        placeholder="YYYY-MM-DD"
                        value={
                          quotationForm.values.valid_upto
                            ? new Date(quotationForm.values.valid_upto)
                            : null
                        }
                        onChange={(date) => {
                          const formatted = date
                            ? dayjs(date).format("YYYY-MM-DD")
                            : "";
                          quotationForm.setFieldValue("valid_upto", formatted);
                        }}
                        valueFormat="YYYY-MM-DD"
                        leftSection={<IconCalendar size={18} />}
                        leftSectionPointerEvents="none"
                        radius="sm"
                        size="sm"
                        error={quotationForm.errors.valid_upto}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={1.25}>
                    <Checkbox
                      key={`${currentServiceId}-multi-carrier`}
                      label="Multi Carrier"
                      checked={quotationForm.values.multi_carrier === "true"}
                      onChange={(event) => {
                        quotationForm.setFieldValue(
                          "multi_carrier",
                          event.currentTarget.checked ? "true" : "false",
                        );
                      }}
                      styles={{
                        label: {
                          fontSize: "14px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                          color: "#424242",
                          fontWeight: 500,
                        },
                        input: {
                          cursor: "pointer",
                        },
                      }}
                      mt={28}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.25}>
                    <Dropdown
                      label="Quote Type"
                      searchable
                      key={quotationForm.key("quote_type")}
                      placeholder="Enter Quote Type"
                      data={["Standard", "Lumpsum", "All Inclusive"]}
                      styles={{
                        input: {
                          fontSize: "14px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                        label: {
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                      }}
                      {...quotationForm.getInputProps("quote_type")}
                    />
                  </Grid.Col>
                  {selectedService?.service !== "LCL" && (
                    <Grid.Col span={1.25}>
                      <SearchableSelect
                        label="Carrier"
                        placeholder="Type carrier name"
                        apiEndpoint={URL.carrier}
                        searchFields={["carrier_code", "carrier_name"]}
                        displayFormat={carrierDisplayFormat}
                        value={quotationForm.values.carrier_code || null}
                          displayValue={formatCarrierDisplayValue(
                            carrierData.find(
                              (c) =>
                                c.value === quotationForm.values.carrier_code,
                            )?.label,
                            quotationForm.values.carrier_code,
                          )}
                        onChange={(value) => {
                          quotationForm.setFieldValue(
                            "carrier_code",
                            value || "",
                          );
                          if (!value) {
                            setSelectedCarrierCode("");
                            setTempSelectedCarrier(null);
                          }
                        }}
                        minSearchLength={2}
                        dropdownZIndex={10}
                        styles={{
                          input: {
                            fontSize: "14px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                          label: {
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "#424242",
                            marginBottom: "4px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        error={
                          quotationForm.errors.carrier_code as
                            | string
                            | undefined
                        }
                        additionalParams={carrierTransportModeParams}
                      />
                    </Grid.Col>
                  )}
                  <Grid.Col span={1.65}>
                    <Dropdown
                      label="Status"
                      placeholder="Select Status"
                      searchable
                      data={[
                        { value: "QUOTE CREATED", label: "Quote Created" },
                        { value: "GAINED", label: "Gained" },
                        { value: "LOST", label: "Lost" },
                      ]}
                      styles={{
                        input: {
                          fontSize: "14px",
                          fontFamily: "Inter",
                          height: "36px",
                        },
                        label: {
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        },
                      }}
                      {...quotationForm.getInputProps("status")}
                    />
                  </Grid.Col>
                  <Grid.Col span={2}>
                    <Flex gap="sm" align="flex-end">
                      <div style={{ flex: 1 }}>
                        <RemarkInputWithTooltip
                          value={quotationForm.values.remark}
                          error={
                            quotationForm.errors.remark
                              ? String(quotationForm.errors.remark)
                              : undefined
                          }
                          isRemarkRequired={isRemarkRequired}
                          isViewMode={false}
                          onChange={(formattedValue) =>
                            quotationForm.setFieldValue(
                              "remark",
                              formattedValue,
                            )
                          }
                        />
                      </div>
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
                                <IconNotes size={16} color="#105476" />
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
                            onClick={handleOpenNotesConditionsModal}
                          >
                            Notes & Conditions
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
                                <IconChartBar size={16} color="#105476" />
                              </Box>
                            }
                            disabled={selectedService?.service === "LCL"}
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
                              if (!carrierComparisonData) {
                                fetchCarrierComparison();
                              }
                              openCarrierModal();
                            }}
                          >
                            Check carrier comparison
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
                                <IconDatabase size={16} color="#105476" />
                              </Box>
                            }
                            disabled={
                              selectedService?.service === "FCL" &&
                              !quotationForm.values.carrier_code
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
                            onClick={() => open()}
                          >
                            Get tariff data
                          </Menu.Item>
                          {isStandaloneEdit && (
                            <>
                              <Menu.Divider />
                              {actualEnquiryData?.status === "GAINED" && (
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
                                      <IconBook size={16} color="#105476" />
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
                                      fontSize: "14px",
                                      fontWeight: 500,
                                      color: "#424242",
                                    },
                                  }}
                                  onClick={() => {
                                    handleCreateBooking();
                                  }}
                                >
                                  Create Booking
                                </Menu.Item>
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
                                    <IconHistory size={16} color="#105476" />
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
                                    fontSize: "14px",
                                    fontWeight: 500,
                                    color: "#424242",
                                  },
                                }}
                                onClick={fetchChargeHistory}
                              >
                                Check charge history
                              </Menu.Item>
                            </>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Flex>
                  </Grid.Col>
                </Grid>

                {/* Dynamic Charges */}
                <Stack
                  justify="lg"
                  key={`dynamic-form-${currentServiceId}`}
                  px={0}
                >
                  {dynamicForm.values.charges.length > 0 && (
                    <Grid
                      style={{
                        fontWeight: 600,
                        color: "#105476",
                      }}
                      gutter="sm"
                    >
                      <Grid.Col span={2}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          Charge Name
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          Currency
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={0.75}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          ROE
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          Unit
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={0.5}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          No of Units
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          Sell Per Unit
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          Min Sell
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          Cost Per Unit
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          Total Sell
                          {branchCurrencyCode ? ` (${branchCurrencyCode})` : ""}
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Text
                          style={{
                            fontFamily: "Inter",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#000000",
                          }}
                        >
                          Total Cost
                          {branchCurrencyCode ? ` (${branchCurrencyCode})` : ""}
                        </Text>
                      </Grid.Col>
                    </Grid>
                  )}
                  {dynamicForm.values.charges.map((_, index) => (
                    <Box key={index}>
                      <Grid gutter="sm">
                        <Grid.Col span={2}>
                          {dynamicForm.values.charges[index]?.charge_id !=
                          null ? (
                            <TextInput
                              placeholder="Charge Name"
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.charge_name`,
                              )}
                              readOnly={isViewMode}
                              disabled={isViewMode}
                              rightSection={
                                isViewMode ? null : (
                                  <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => {
                                      dynamicForm.setFieldValue(
                                        `charges.${index}.charge_name`,
                                        "",
                                      );
                                      dynamicForm.setFieldValue(
                                        `charges.${index}.charge_id`,
                                        null,
                                      );
                                    }}
                                    aria-label="Clear charge name"
                                  >
                                    <Text
                                      style={{
                                        fontSize: 18,
                                        lineHeight: 1,
                                        fontWeight: 700,
                                      }}
                                    >
                                      ×
                                    </Text>
                                  </ActionIcon>
                                )
                              }
                            />
                          ) : (
                            <SearchableSelect
                              placeholder="Charge Name"
                              apiEndpoint={URL.chargeMaster}
                              dropdownZIndex={310}
                              searchFields={["charge_code", "charge_name"]}
                              displayFormat={(
                                item: Record<string, unknown>,
                              ) => {
                                const charge = item as {
                                  id?: number;
                                  charge_name?: string;
                                };
                                const name = charge.charge_name || "";
                                return {
                                  value: String(charge.id ?? ""),
                                  label: name,
                                };
                              }}
                              value={
                                dynamicForm.values.charges[index]?.charge_id !=
                                null
                                  ? String(
                                      dynamicForm.values.charges[index]
                                        .charge_id,
                                    )
                                  : null
                              }
                              displayValue={
                                dynamicForm.values.charges[index]
                                  ?.charge_name || ""
                              }
                              onChange={(value, selected, originalData) => {
                                if (isViewMode) return;
                                const original = (originalData || {}) as {
                                  id?: number;
                                  charge_name?: string;
                                };
                                const name =
                                  original.charge_name !== undefined &&
                                  original.charge_name !== null
                                    ? original.charge_name
                                    : selected?.label
                                      ? selected.label.split(" (")[0]
                                      : "";
                                dynamicForm.setFieldValue(
                                  `charges.${index}.charge_name`,
                                  name,
                                );
                                if (original.id != null) {
                                  dynamicForm.setFieldValue(
                                    `charges.${index}.charge_id`,
                                    original.id,
                                  );
                                } else if (value) {
                                  dynamicForm.setFieldValue(
                                    `charges.${index}.charge_id`,
                                    Number(value),
                                  );
                                } else {
                                  dynamicForm.setFieldValue(
                                    `charges.${index}.charge_id`,
                                    null,
                                  );
                                }
                              }}
                              readOnly={isViewMode}
                              disabled={isViewMode}
                              error={
                                (dynamicForm.errors as any)?.charges?.[index]
                                  ?.charge_name as string | undefined
                              }
                              returnOriginalData
                              styles={{
                                input: {
                                  fontSize: "14px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                            />
                          )}
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Dropdown
                            placeholder="Select Currency"
                            searchable
                            key={`unit-${index}-currency_country_code`}
                            data={currency}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.currency_country_code`,
                            )}
                            onChange={(value) => {
                              handleChargeCurrencyChange(index, value || "");
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={0.75}>
                          <TextInput
                            key={`unit-${index}-roe`}
                            min={1}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...bindChargeAmountInput(index, "roe")}
                            readOnly={
                              isViewMode ||
                              isBaseCurrency(
                                dynamicForm.values.charges[index]
                                  ?.currency_country_code,
                              )
                            }
                            disabled={
                              isViewMode ||
                              isBaseCurrency(
                                dynamicForm.values.charges[index]
                                  ?.currency_country_code,
                              )
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Dropdown
                            searchable
                            placeholder="Select Unit"
                            data={unitData}
                            key={`unit-${index}-no_of_units`}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.unit`,
                            )}
                            onChange={(value) => {
                              applyChargeUnitSelection(index, value);
                            }}
                            onOptionSubmit={(value) => {
                              applyChargeUnitSelection(index, value);
                            }}
                            disabled={isLoadingUnitData}
                          />
                        </Grid.Col>
                        <Grid.Col span={0.5}>
                          <TextInput
                            key={`unit-${index}-no_of_units`}
                            min={1}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...bindChargeAmountInput(index, "no_of_units")}
                            disabled={
                              dynamicForm.values.charges[index]?.toBeDisabled
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <FormNumberInput
                            key={`unit-${index}-sell_per_unit`}
                            min={0}
                            hideControls
                            decimalScale={currencyAmountDecimalScale}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...bindChargeMoneyField(index, "sell_per_unit")}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <FormNumberInput
                            key={`unit-${index}-min_sell`}
                            disabled={
                              dynamicForm.values.charges[index]?.toBeDisabled
                            }
                            min={0}
                            hideControls
                            decimalScale={currencyAmountDecimalScale}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...bindChargeMoneyField(index, "min_sell")}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <FormNumberInput
                            key={`unit-${index}-cost_per_unit`}
                            disabled={
                              dynamicForm.values.charges[index]?.toBeDisabled
                            }
                            min={0}
                            hideControls
                            decimalScale={currencyAmountDecimalScale}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...bindChargeMoneyField(index, "cost_per_unit")}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <FormNumberInput
                            key={`unit-${index}-total_sell`}
                            value={moneyFormValueToNumber(
                              dynamicForm.values.charges[index]?.total_sell ??
                                formatMoneyAmountBound(0),
                            )}
                            decimalScale={localAmountDecimalScale}
                            groupThousands
                            hideControls
                            readOnly
                            disabled={isViewMode}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                                backgroundColor: isViewMode
                                  ? "#ffffff"
                                  : "#f8f9fa",
                                cursor: isViewMode ? "default" : "not-allowed",
                              },
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <FormNumberInput
                            key={`unit-${index}-total_cost`}
                            value={moneyFormValueToNumber(
                              dynamicForm.values.charges[index]?.total_cost ??
                                formatMoneyAmountBound(0),
                            )}
                            decimalScale={localAmountDecimalScale}
                            groupThousands
                            hideControls
                            readOnly
                            disabled={isViewMode}
                            styles={{
                              input: {
                                fontSize: "14px",
                                fontFamily: "Inter",
                                height: "36px",
                                backgroundColor: isViewMode
                                  ? "#ffffff"
                                  : "#f8f9fa",
                                cursor: isViewMode ? "default" : "not-allowed",
                              },
                            }}
                          />
                        </Grid.Col>

                        {dynamicForm.values.charges.length - 1 === index && (
                          <Grid.Col span={0.75}>
                            <Button
                              radius={"sm"}
                              variant="light"
                              color="#105476"
                              onClick={() =>
                                dynamicForm.insertListItem("charges", {
                                  charge_name: "",
                                  charge_id: null,
                                  ...getDefaultNewChargeFields(),
                                  unit: "",
                                  no_of_units: "",
                                  sell_per_unit: "",
                                  min_sell: "",
                                  cost_per_unit: "",
                                  total_cost: "",
                                  total_sell: "",
                                })
                              }
                            >
                              <IconPlus size={16} />
                            </Button>
                          </Grid.Col>
                        )}
                        <Grid.Col span={0.75}>
                          {dynamicForm.values.charges.length > 1 ? (
                            <Button
                              variant="light"
                              color="red"
                              onClick={() =>
                                dynamicForm.removeListItem("charges", index)
                              }
                            >
                              <IconTrash size={16} />
                            </Button>
                          ) : (
                            ""
                          )}
                        </Grid.Col>
                      </Grid>
                    </Box>
                  ))}

                  <Grid
                    style={{
                      fontWeight: 600,
                      color: "#105476",
                      paddingTop: "0.5rem",
                    }}
                  >
                    <Grid.Col span={7.5} />
                    <Grid.Col span={1} ml={10}>
                      Total:
                    </Grid.Col>
                    <Grid.Col span={1}>{formatMoneyDisplay(netSell)}</Grid.Col>
                    <Grid.Col span={1}> {formatMoneyDisplay(netCost)}</Grid.Col>
                  </Grid>
                  <Grid
                    mt={8}
                    style={{
                      fontWeight: 600,
                      color: profit >= 0 ? "green" : "red",
                    }}
                  >
                    <Grid.Col span={7.5} />
                    <Grid.Col span={1} ml={10}>
                      Profit
                      {branchCurrencyCode ? ` (${branchCurrencyCode})` : ""}=
                    </Grid.Col>
                    <Grid.Col span={1}> {formatMoneyDisplay(profit)}</Grid.Col>
                  </Grid>
                  {showQuoteCurrencyProfit && (
                    <Grid
                      mt={4}
                      style={{
                        fontWeight: 600,
                        color: profitInQuoteCurrency >= 0 ? "green" : "red",
                      }}
                    >
                      <Grid.Col span={7.5} />
                      <Grid.Col span={1} ml={10}>
                        Profit ({normalizedQuoteCurrency})=
                      </Grid.Col>
                      <Grid.Col span={1}>
                        {" "}
                        {formatMoneyAmountForUi(profitInQuoteCurrency, false)}
                      </Grid.Col>
                    </Grid>
                  )}
                </Stack>
              </Box>
            </Box>

            {/* Footer - Fixed at bottom of container */}
            <Box
              style={{
                borderTop: "1px solid #e9ecef",
                padding: "20px 32px",
                backgroundColor: "#ffffff",
                flexShrink: 0,
              }}
            >
              <Group justify="space-between">
                <Group>
                  <Button
                    variant="outline"
                    color="#000"
                    onClick={() => {
                      if (goToStep && typeof goToStep === "function") {
                        // Navigate back to enquiry form (stepper 2 - service details)
                        goToStep(1);
                      } else if (
                        location.state?.returnTo === "dashboard-pipeline"
                      ) {
                        // Navigate back to dashboard (Pipeline Report tab) when from pipeline report
                        navigate("/", {
                          state: {
                            returnToPipelineReport: true,
                            pipelineReportState:
                              location.state?.pipelineReportState,
                          },
                        });
                      } else if (location.state?.returnTo === "dashboard") {
                        // Navigate back to dashboard (Enquiry detailed view) when from enquiry conversion
                        navigate("/", {
                          state: {
                            returnToEnquiryDetailedView: true,
                            dashboardState: location.state?.returnToState,
                          },
                        });
                      } else if (
                        isStandaloneEdit &&
                        (actualEnquiryData?.enquiry_id ||
                          quotationData?.enquiry_id ||
                          fetchedQuotationData?.enquiry_id)
                      ) {
                        const serviceDataSnapshot =
                          snapshotServiceQuotationData();
                        const preserveFilters = location.state?.preserveFilters;
                        const fromQuotation = !location.state?.fromEnquiry;
                        const fromEnquiry = location.state?.fromEnquiry;
                        const dataSource =
                          actualEnquiryData ||
                          fetchedQuotationData ||
                          quotationData;
                        const enquiryId =
                          dataSource?.enquiry_id ||
                          quotationData?.enquiry_id ||
                          fetchedQuotationData?.enquiry_id;
                        const enquiryIdForNav =
                          quotationData?.enquiry_pk ||
                          fetchedQuotationData?.enquiry_pk ||
                          dataSource?.enquiry_pk ||
                          quotationData?.enquiry_id ||
                          fetchedQuotationData?.enquiry_id ||
                          dataSource?.enquiry_id ||
                          (actualEnquiryData?.id && !quotationData
                            ? actualEnquiryData.id
                            : null) ||
                          (fetchedQuotationData?.id && !quotationData
                            ? fetchedQuotationData.id
                            : null);
                        const serviceDetails = services.map((service) => ({
                          id: service.id,
                          service: service.service,
                          service_type:
                            (service as any).service_type || service.service,
                          trade: service.trade,
                          service_code: (service as any).service_code || "",
                          service_name: (service as any).service_name || "",
                          origin_code: service.origin_code_read || "",
                          origin_code_read: service.origin_code_read || "",
                          origin_name: service.origin_name || "",
                          destination_code: service.destination_code_read || "",
                          destination_code_read:
                            service.destination_code_read || "",
                          destination_name: service.destination_name || "",
                          pickup: service.pickup,
                          delivery: service.delivery,
                          pickup_location: service.pickup_location || "",
                          delivery_location: service.delivery_location || "",
                          hazardous_cargo: service.hazardous_cargo || false,
                          stackable:
                            (service as any).stackable !== undefined
                              ? (service as any).stackable
                              : true,
                          shipment_terms_code:
                            service.shipment_terms_code_read || "",
                          shipment_terms_code_read:
                            service.shipment_terms_code_read || "",
                          shipment_terms_name:
                            service.shipment_terms_name || "",
                          fcl_details: service.fcl_details,
                          no_of_packages: service.no_of_packages,
                          gross_weight: service.gross_weight,
                          volume_weight: service.volume_weight,
                          chargeable_weight: service.chargeable_weight,
                          volume: service.volume,
                          chargeable_volume: service.chargeable_volume,
                        }));
                        const enquiryDataToPass = {
                          id: enquiryIdForNav,
                          enquiry_id: enquiryId,
                          actionType: "editQuotation",
                          customer_code:
                            dataSource?.customer_code ||
                            quotationData?.customer_code ||
                            fetchedQuotationData?.customer_code,
                          customer_code_read:
                            dataSource?.customer_code ||
                            quotationData?.customer_code ||
                            fetchedQuotationData?.customer_code,
                          customer_name:
                            dataSource?.customer_name ||
                            quotationData?.customer_name ||
                            fetchedQuotationData?.customer_name,
                          customer_address:
                            dataSource?.customer_address ||
                            quotationData?.customer_address ||
                            fetchedQuotationData?.customer_address,
                          sales_person:
                            dataSource?.sales_person ||
                            quotationData?.sales_person ||
                            fetchedQuotationData?.sales_person,
                          sales_coordinator:
                            dataSource?.sales_coordinator ||
                            quotationData?.sales_coordinator ||
                            fetchedQuotationData?.sales_coordinator ||
                            "",
                          customer_services:
                            dataSource?.customer_services ||
                            quotationData?.customer_services ||
                            fetchedQuotationData?.customer_services ||
                            "",
                          enquiry_received_date:
                            dataSource?.enquiry_received_date ||
                            quotationData?.enquiry_received_date ||
                            fetchedQuotationData?.enquiry_received_date,
                          reference_no:
                            dataSource?.reference_no ||
                            quotationData?.reference_no ||
                            fetchedQuotationData?.reference_no ||
                            "",
                          services: serviceDetails,
                          preserveFilters,
                          fromQuotation,
                          fromEnquiry,
                          quotation:
                            dataSource?.quotation ||
                            quotationData?.quotation ||
                            fetchedQuotationData?.quotation,
                          serviceQuotationState: serviceDataSnapshot,
                          quotationId: quotationIdForEdit || undefined,
                        };
                        navigate("/enquiry-create", {
                          state: enquiryDataToPass,
                        });
                      } else if (location.state?.fromEnquiry) {
                        const preserveFilters = location.state?.preserveFilters;
                        if (preserveFilters) {
                          navigate("/enquiry", {
                            state: {
                              restoreFilters: preserveFilters,
                              refreshData: true,
                            },
                          });
                        } else {
                          navigate("/enquiry", {
                            state: { refreshData: true },
                          });
                        }
                      } else if (location.state?.returnTo === "call-entry") {
                        navigate("/call-entry-create", {
                          state: location.state.returnToState,
                        });
                      } else {
                        navigateToPreferredList(
                          location.state?.preserveFilters,
                        );
                      }
                    }}
                  >
                    {isViewMode ? "Back to Dashboard" : "Back"}
                  </Button>
                </Group>
                {!isViewMode && (
                  <Group>
                    <Button
                      rightSection={
                        isSubmittingQuotation ? (
                          <Loader size={16} color="white" />
                        ) : (
                          <IconCheck size={16} />
                        )
                      }
                      onClick={() => quotationSubmit()}
                      color="teal"
                      disabled={isSubmittingQuotation}
                    >
                      {isSubmittingQuotation
                        ? isStandaloneEdit
                          ? "Updating..."
                          : "Submitting..."
                        : isStandaloneEdit
                          ? "Update"
                          : "Submit"}
                    </Button>
                  </Group>
                )}
              </Group>
            </Box>
          </Box>
        )}
      </Box>

      {/* Notes & Conditions Modal */}
      <Modal
        opened={notesConditionsModalOpened}
        onClose={() => setNotesConditionsModalOpened(false)}
        title={
          <Text size="lg" fw={600} c="#105476">
            Notes & Conditions
          </Text>
        }
        size="90%"
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          content: {
            border: "1px solid #105476",
            borderRadius: 12,
          },
        }}
      >
        {isLoadingNotesConditions ? (
          <Center py="xl">
            <Loader size="md" color="#105476" />
          </Center>
        ) : (
          <Stack gap="lg">
            <Grid gutter="sm">
              {/* Notes Section - Left Side */}
              <Grid.Col span={6}>
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: notesScrollable ? "500px" : "auto",
                    position: notesScrollable ? "sticky" : "relative",
                    top: notesScrollable ? "0" : "auto",
                  }}
                >
                  {/* Sticky Header */}
                  <Group
                    justify="space-between"
                    mb="md"
                    style={{
                      position: "sticky",
                      top: 0,
                      backgroundColor: "white",
                      zIndex: 20,
                      paddingBottom: "0.5rem",
                      borderBottom: notesScrollable
                        ? "1px solid #e9ecef"
                        : "none",
                    }}
                  >
                    <Text fw={600} size="md" c="#105476">
                      Notes
                    </Text>
                    <Group gap="md">
                      <Box
                        style={{
                          marginBottom: "0.2rem",
                        }}
                      >
                        <Text size="xs" c="dimmed">
                          Allowed 150 characters at each input
                        </Text>
                      </Box>
                      <Button
                        size="xs"
                        variant="light"
                        color="#105476"
                        onClick={handleAddNote}
                        leftSection={<IconPlus size={14} />}
                        style={{ zIndex: 21 }}
                      >
                        Add More
                      </Button>
                    </Group>
                  </Group>

                  {/* Scrollable Content - Only Inputs */}
                  <Box
                    ref={notesScrollRef}
                    style={{
                      flex: 1,
                      maxHeight: notesScrollable
                        ? `${INPUT_CONTAINER_MAX_HEIGHT}px`
                        : "none",
                      overflowY: notesScrollable ? "auto" : "visible",
                      overflowX: "hidden",
                      paddingRight: notesScrollable ? "8px" : "0",
                      position: "relative",
                    }}
                  >
                    <Stack gap="sm">
                      {notes.map((note, index) => (
                        <Group
                          key={index}
                          align="flex-start"
                          gap="xs"
                          wrap="nowrap"
                        >
                          <Box
                            style={{
                              position: "relative",
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <Textarea
                              placeholder={`Note ${index + 1}`}
                              value={note}
                              onChange={(e) =>
                                handleNoteChange(index, e.target.value)
                              }
                              maxLength={150}
                              minRows={1}
                              autosize
                              styles={{
                                input: {
                                  resize: "vertical",
                                  wordWrap: "break-word",
                                  overflowWrap: "break-word",
                                  textIndent: "8px",
                                },
                              }}
                            />
                            <Text
                              size="lg"
                              c="#105476"
                              style={{
                                position: "absolute",
                                left: 8,
                                top: 6,
                                pointerEvents: "none",
                                lineHeight: 1,
                              }}
                            >
                              •
                            </Text>
                          </Box>
                          {notes.length > 1 && (
                            <Button
                              size="xs"
                              variant="light"
                              color="red"
                              onClick={() => handleRemoveNote(index)}
                              style={{ flexShrink: 0 }}
                            >
                              <IconTrash size={14} />
                            </Button>
                          )}
                        </Group>
                      ))}
                    </Stack>
                    {notesScrollable && !notesAtBottom && (
                      <Box
                        style={{
                          position: "sticky",
                          bottom: 8,
                          display: "flex",
                          justifyContent: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <Button
                          size="xs"
                          radius="xl"
                          color="#105476"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            scrollNotesDown();
                          }}
                          style={{
                            pointerEvents: "auto",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                          }}
                        >
                          <IconChevronDown size={14} />
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Card>
              </Grid.Col>

              {/* Conditions Section - Right Side */}
              <Grid.Col span={6}>
                <Card
                  shadow="sm"
                  padding="md"
                  radius="md"
                  withBorder
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: conditionsScrollable ? "500px" : "auto",
                    position: conditionsScrollable ? "sticky" : "relative",
                    top: conditionsScrollable ? "0" : "auto",
                  }}
                >
                  {/* Sticky Header */}
                  <Group
                    justify="space-between"
                    mb="md"
                    style={{
                      position: "sticky",
                      top: 0,
                      backgroundColor: "white",
                      zIndex: 20,
                      paddingBottom: "0.5rem",
                      borderBottom: conditionsScrollable
                        ? "1px solid #e9ecef"
                        : "none",
                    }}
                  >
                    <Text fw={600} size="md" c="#105476">
                      Conditions
                    </Text>
                    <Group gap="md">
                      <Box
                        style={{
                          marginBottom: "0.2rem",
                        }}
                      >
                        <Text size="xs" c="dimmed">
                          Allowed 150 characters at each input
                        </Text>
                      </Box>
                      <Button
                        size="xs"
                        variant="light"
                        color="#105476"
                        onClick={handleAddCondition}
                        leftSection={<IconPlus size={14} />}
                        style={{ zIndex: 21 }}
                      >
                        Add More
                      </Button>
                    </Group>
                  </Group>

                  {/* Scrollable Content - Only Inputs */}
                  <Box
                    ref={conditionsScrollRef}
                    style={{
                      flex: 1,
                      maxHeight: conditionsScrollable
                        ? `${INPUT_CONTAINER_MAX_HEIGHT}px`
                        : "none",
                      overflowY: conditionsScrollable ? "auto" : "visible",
                      overflowX: "hidden",
                      paddingRight: conditionsScrollable ? "8px" : "0",
                      position: "relative",
                    }}
                  >
                    <Stack gap="sm">
                      {conditions.map((condition, index) => (
                        <Group
                          key={index}
                          align="flex-start"
                          gap="xs"
                          wrap="nowrap"
                        >
                          <Box
                            style={{
                              position: "relative",
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <Textarea
                              placeholder={`Condition ${index + 1}`}
                              value={condition}
                              onChange={(e) =>
                                handleConditionChange(index, e.target.value)
                              }
                              maxLength={150}
                              minRows={1}
                              autosize
                              styles={{
                                input: {
                                  resize: "vertical",
                                  wordWrap: "break-word",
                                  overflowWrap: "break-word",
                                  textIndent: "8px",
                                },
                              }}
                            />
                            <Text
                              size="lg"
                              c="#105476"
                              style={{
                                position: "absolute",
                                left: 8,
                                top: 6,
                                pointerEvents: "none",
                                lineHeight: 1,
                              }}
                            >
                              •
                            </Text>
                          </Box>
                          {conditions.length > 1 && (
                            <Button
                              size="xs"
                              variant="light"
                              color="red"
                              onClick={() => handleRemoveCondition(index)}
                              style={{ flexShrink: 0 }}
                            >
                              <IconTrash size={14} />
                            </Button>
                          )}
                        </Group>
                      ))}
                    </Stack>
                    {conditionsScrollable && !conditionsAtBottom && (
                      <Box
                        style={{
                          position: "sticky",
                          bottom: 8,
                          display: "flex",
                          justifyContent: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <Button
                          size="xs"
                          radius="xl"
                          color="#105476"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            scrollConditionsDown();
                          }}
                          style={{
                            pointerEvents: "auto",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                          }}
                        >
                          <IconChevronDown size={14} />
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Sticky Footer Buttons */}
            <Group
              justify="flex-end"
              mt="md"
              style={{
                position: "sticky",
                bottom: 0,
                backgroundColor: "white",
                paddingTop: "1rem",
                zIndex: 20,
                borderTop: "1px solid #e9ecef",
              }}
            >
              <Button
                variant="default"
                onClick={() => setNotesConditionsModalOpened(false)}
              >
                Close
              </Button>
              <Button
                style={{ backgroundColor: "#105476", color: "white" }}
                onClick={handleUpdateNotesConditions}
              >
                Update
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Unfilled Services Modal */}
      <Modal
        opened={unfilledServicesModalOpened}
        onClose={() => setUnfilledServicesModalOpened(false)}
        title={
          <Text size="lg" fw={600} c="#105476">
            Unfilled Services Detected
          </Text>
        }
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          content: {
            border: "1px solid #105476",
            borderRadius: 12,
            padding: "20px",
          },
        }}
      >
        <Stack gap="md">
          <Text size="md">
            {unfilledServices.length} more service
            {unfilledServices.length > 1 ? "s" : ""}{" "}
            {unfilledServices.length > 1 ? "are" : "is"} found. Would you like
            to create quotation for{" "}
            {unfilledServices.length > 1 ? "those" : "that"}?
          </Text>

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setUnfilledServicesModalOpened(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              color="#105476"
              onClick={handleSubmitWithIncompleteData}
            >
              Submit Current Data
            </Button>
            <Button
              style={{ backgroundColor: "#105476", color: "white" }}
              onClick={handleProceedToUnfilledService}
            >
              Yes, Proceed
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Top Carrier Modal */}
      <Modal
        opened={carrierModalOpened}
        onClose={closeCarrierModal}
        title={
          <Text size="lg" fw={600} c="#105476">
            Carriers and Rates
          </Text>
        }
        size="70%"
        padding="lg"
        centered
      >
        {isLoadingCarriers && (
          <Center py="xl">
            <Loader size="md" />
          </Center>
        )}

        {carrierComparisonData && (
          <>
            {/* Main Carrier Header */}
            <Text size="lg" fw={600} c="#105476" mt="md" mb="sm">
              Main Carrier
            </Text>
            {carrierComparisonData.main_carrier &&
            carrierComparisonData.main_carrier.length > 0 ? (
              <Grid mt="md">
                {carrierComparisonData.main_carrier.map(
                  (carrier: any, index: number) => {
                    const isSelected =
                      selectedCarrierCode === carrier.carrier_code;
                    return (
                      <Grid.Col key={index} span={2.4}>
                        <Card
                          p="xs"
                          style={{
                            backgroundColor: "white",
                            borderRadius: "8px",
                            border: isSelected
                              ? "2px solid #105476"
                              : "1px solid #e9ecef",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            height: "80px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            position: "relative",
                          }}
                          onClick={() => {
                            handleCarrierCardClick(carrier);
                            closeCarrierModal();
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.transform =
                                "translateY(-2px)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 12px rgba(16, 84, 118, 0.15)";
                              e.currentTarget.style.borderColor = "#105476";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "none";
                              e.currentTarget.style.borderColor = "#e9ecef";
                            }
                          }}
                        >
                          <Stack
                            gap={4}
                            align="center"
                            justify="center"
                            h="100%"
                          >
                            <Text
                              size="xs"
                              fw={500}
                              c={"#105476"}
                              ta="center"
                              style={{ lineHeight: "1" }}
                              lineClamp={2}
                            >
                              {carrier.carrier_name}
                            </Text>
                            <Text
                              size="xs"
                              c={isSelected ? "#105476" : "#adb5bd"}
                              ta="center"
                              fw={600}
                            >
                              ₹{formatMoneyAmountForUi(carrier.all_inclusive_total)}
                            </Text>
                          </Stack>
                        </Card>
                      </Grid.Col>
                    );
                  },
                )}
              </Grid>
            ) : (
              <Center py="md">
                <Text c="dimmed">No data available</Text>
              </Center>
            )}

            {/* NVOCC Header */}
            <Text size="lg" fw={600} c="#105476" mt="xl" mb="sm">
              NVOCC
            </Text>
            {carrierComparisonData?.Nvocc &&
            carrierComparisonData.Nvocc.length > 0 ? (
              <Grid mt="md">
                {carrierComparisonData.Nvocc.map(
                  (carrier: any, index: number) => {
                    const isSelected =
                      selectedCarrierCode === carrier.carrier_code;
                    return (
                      <Grid.Col key={index} span={2.4}>
                        <Card
                          p="xs"
                          style={{
                            backgroundColor: "white",
                            borderRadius: "8px",
                            border: isSelected
                              ? "2px solid #105476"
                              : "1px solid #e9ecef",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            height: "80px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            position: "relative",
                          }}
                          onClick={() => {
                            handleCarrierCardClick(carrier);
                            closeCarrierModal();
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.transform =
                                "translateY(-2px)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 12px rgba(16, 84, 118, 0.15)";
                              e.currentTarget.style.borderColor = "#105476";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "none";
                              e.currentTarget.style.borderColor = "#e9ecef";
                            }
                          }}
                        >
                          <Stack
                            gap={4}
                            align="center"
                            justify="center"
                            h="100%"
                          >
                            <Text
                              size="xs"
                              fw={500}
                              c={"#105476"}
                              ta="center"
                              style={{ lineHeight: "1" }}
                              lineClamp={2}
                            >
                              {carrier.carrier_name}
                            </Text>
                            <Text
                              size="xs"
                              c={isSelected ? "#105476" : "#adb5bd"}
                              ta="center"
                              fw={600}
                            >
                              ₹{formatMoneyAmountForUi(carrier.all_inclusive_total)}
                            </Text>
                          </Stack>
                        </Card>
                      </Grid.Col>
                    );
                  },
                )}
              </Grid>
            ) : (
              <Center py="md">
                <Text c="dimmed">No data available</Text>
              </Center>
            )}
          </>
        )}
        {!carrierComparisonData && !isLoadingCarriers && (
          <Center py="xl">
            <Text c="dimmed">No carrier data available</Text>
          </Center>
        )}
      </Modal>

      {/* Charge History Modal */}
      <Modal
        opened={chargeHistoryModalOpened}
        onClose={() => {
          setChargeHistoryModalOpened(false);
          setChargeHistoryData([]);
        }}
        title={
          <Text size="lg" fw={600} c="#105476">
            Charge History
          </Text>
        }
        size="90%"
        centered
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        styles={{
          content: {
            border: "1px solid #105476",
            borderRadius: 12,
          },
        }}
      >
        {isLoadingChargeHistory ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="md" color="#105476" />
              <Text c="dimmed">Loading charge history...</Text>
            </Stack>
          </Center>
        ) : chargeHistoryData.length === 0 ? (
          <Center py="xl">
            <Text c="dimmed">No charge history available</Text>
          </Center>
        ) : (
          <Box
            style={{
              position: "relative",
              border: "1px solid #dee2e6",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <ScrollArea
              h={
                chargeHistoryData.length <= 5
                  ? Math.max(200, chargeHistoryData.length * 50)
                  : chargeHistoryData.length <= 10
                    ? 400
                    : 600
              }
            >
              <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders
                style={{
                  fontSize: "0.875rem",
                }}
              >
                <Table.Thead
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    backgroundColor: "#105476",
                  }}
                >
                  <Table.Tr>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Action
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Charge Name
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Currency
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      ROE
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Unit
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      No. of Units
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Sell Per Unit
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Min Sell
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Cost Per Unit
                    </Table.Th>
                    {/* <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Min Cost
                    </Table.Th> */}
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Total Cost
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Total Sell
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Action By
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "white",
                        fontWeight: 600,
                        textAlign: "center",
                        backgroundColor: "#105476",
                      }}
                    >
                      Timestamp
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {chargeHistoryData.map((historyItem: any, index: number) => (
                    <Table.Tr key={historyItem.id || index}>
                      <Table.Td style={{ textAlign: "center" }}>
                        <Badge
                          color={
                            historyItem.action_type === "CREATED"
                              ? "green"
                              : historyItem.action_type === "UPDATED"
                                ? "blue"
                                : historyItem.action_type === "DELETED"
                                  ? "red"
                                  : "gray"
                          }
                          variant="light"
                        >
                          {historyItem.action_type}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.charge_name || "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.currency_code ||
                          historyItem.currency ||
                          "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.roe
                          ? parseFloat(historyItem.roe).toFixed(6)
                          : "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.unit || "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.no_of_units || "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {formatHistoryCurrencyMoney(historyItem.sell_per_unit)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {formatHistoryCurrencyMoney(historyItem.min_sell)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {formatHistoryCurrencyMoney(historyItem.cost_per_unit)}
                      </Table.Td>
                      {/* <Table.Td style={{ textAlign: "center" }}>
                        {formatHistoryCurrencyMoney(historyItem.min_cost)}
                      </Table.Td> */}
                      <Table.Td style={{ textAlign: "center" }}>
                        {formatHistoryLocalMoney(historyItem.total_cost)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {formatHistoryLocalMoney(historyItem.total_sell)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.action_type === "CREATED"
                          ? historyItem.created_by
                          : historyItem.action_type === "UPDATED"
                            ? historyItem.updated_by
                            : historyItem.deleted_by || "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.action_timestamp
                          ? dayjs(historyItem.action_timestamp).format(
                              "DD-MM-YYYY HH:mm:ss",
                            )
                          : "-"}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Box>
        )}
      </Modal>
    </Box>
  );
}

export default QuotationCreate;
