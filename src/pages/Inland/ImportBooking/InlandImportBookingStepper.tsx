import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Box,
  Button,
  Group,
  Text,
  Grid,
  Stack,
  Radio,
  Divider,
  Loader,
  Menu,
  Modal,
  Select,
  ActionIcon,
} from "@mantine/core";
import {
  carrierDisplayFormat,
  formatCarrierDisplayValue,
  parseCarrierNameFromLabel,
} from "../../../utils/carrierSelect";
import { Dropzone } from "@mantine/dropzone";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconCheck,
  IconPlus,
  IconTrash,
  IconDotsVertical,
  IconUpload,
  IconDownload,
  IconX,
  IconCalendarEvent,
  IconFileDescription,
  IconBellRinging,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { Dropdown, ToastNotification } from "../../../components";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { getAPICall } from "../../../service/getApiCall";
import { SearchableSelect } from "../../../components";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import useAuthStore from "../../../store/authStore";
import {
  getDefaultBookingChargeCurrencyFields,
  ROE_DECIMAL_PLACES,
  roundRoeForPayload,
} from "../../../utils/exchangeRateRoe";
import { useBookingChargesRoe } from "../../../hooks/useBookingChargesRoe";
import { useDebouncedCallback } from "@mantine/hooks";
import { toTitleCase } from "../../../utils/textFormatter";
import {
  mapShipmentPartyAddressOptions,
  mapShipmentPartySearchResults,
  shipmentPartyAddressMatchesSearch,
  shouldUseCustomShipmentPartyAddress,
} from "../../../utils/shipmentParty";
import {
  applyShipmentTermsSelection,
  normalizeShipmentTermsFreight,
} from "../../../utils/shipmentTermsFreight";
import { roundToDecimals } from "../../../utils/numberInputUtils";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountBound,
  formatMoneyAmountForUi,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
  roundMoneyToDecimals,
  roundLocalMoneyToDecimals,
} from "../../../utils/nonDecimalMoneyAmount";
import {
  applyBookingChargeUnitChange,
  buildBookingCargoNoOfUnitsSyncKey,
  buildBookingUnitOptions,
  mapBookingChargesWithUnits,
  HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS,
  parseNoOfUnitForPayload,
  syncBookingChargesWithCargoNoOfUnits,
} from "../../../utils/houseCargoChargeableWeight";
import {
  findUnitOptionValueByCode,
  resolveAutoUnitForNewCharge,
} from "../../../utils/chargeCalculationTypeUnit";
import FormTextInput from "../../../components/FormTextInput";
import FormNumberInput from "../../../components/FormNumberInput";
import FormTextArea from "../../../components/FormTextArea";
import SingleDateInput from "../../../components/SingleDateInput";
import RequiredLabel from "../../../components/RequiredLabel";
import BookingPackageTypeDropdown from "../../../components/BookingPackageTypeDropdown";
import JobDocumentsModal from "../../../components/JobDocumentsModal";
import { useBookingPageDocuments } from "../../../hooks/useBookingPageDocuments";
import { parseJobDocumentsFromApi } from "../../../utils/jobDocuments";
import { commonSearchAPI } from "../../../service/searchApi";
import { pickPackageTypeCodeFromCargo } from "../../../utils/packageTypeOptions";

interface ExportShipmentStepperProps {
  onStepChange?: (step: number) => void;
  onComplete?: () => void;
  initialData?: Record<string, unknown>;
  isEditMode?: boolean;
  jobData?: Record<string, unknown>;
  active?: number;
  setActive?: (step: number) => void;
  /** Called when quotation flow returns is_booked: true - Create should fetch booking and switch to edit */
  onQuotationAlreadyBooked?: (
    bookingMessage: string,
    bookingId: number,
  ) => void;
  /** Called when edit form has been fully populated with jobData (for hiding loader) */
  onEditFormPopulated?: () => void;
}

interface RoutingDetail {
  id?: number | string;
  move_type: string;
  etd: Date | null;
  eta: Date | null;
  from_location_code: string;
  to_location_code: string;
  carrier_code: string;
  from_location_name: string;
  to_location_name: string;
  carrier_name: string;
  flight_no: string | null;
  status: string;
}

interface CargoDetail {
  id?: number | string;
  // Common fields
  no_of_packages?: number;
  package_type?: string;
  gross_weight?: number;
  volume_weight?: number;
  chargeable_weight?: number;
  volume?: number;
  chargeable_volume?: number;

  // FCL specific fields
  container_type_code?: string;
  no_of_containers?: number;
}

interface BookingEvent {
  type: string;
  date: string;
}

type ServiceMasterItem = {
  service_code: string;
  service_name: string;
};

const fetchInlandImportServices = async (): Promise<ServiceMasterItem[]> => {
  const response = await getAPICall(
    `${URL.serviceMaster}?filter=inland_import`,
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

interface FormValues {
  // Export Shipment fields
  customer_code: string;
  customer_name: string;
  service: string;
  service_code: string;
  service_name: string;
  date: Date;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  shipment_terms_code: string;
  shipment_terms_name: string;
  freight: string;
  routed: string;
  routed_by: string;
  customer_service_name: string;
  /** Inland Import Booking only (root payload) */
  bill_no: string;
  bill_date: Date | null;
  iata: string;
  is_direct: boolean;
  is_coload: boolean;
  /** Root booking ETD/ETA (same payload shape as Ocean schedule) */
  etd: Date | null;
  eta: Date | null;

  // Routing Details
  routingDetails: RoutingDetail[];

  // Party Details fields
  shipper_code: string;
  shipper_name: string;
  shipper_address: string;
  shipper_address_id: number;
  shipper_email: string;
  consignee_code: string;
  consignee_name: string;
  consignee_address_id: number;
  consignee_address: string;
  consignee_email: string;
  forwarder_code: string;
  forwarder_address_id: number;
  forwarder_address: string;
  forwarder_email: string;
  destination_agent_code: string;
  destination_agent_address_id: number;
  destination_agent_email: string;
  billing_customer_code: string;
  billing_customer_address_id: number;
  notify1_customer_name: string;
  notify1_customer_address: string;
  notify1_customer_email: string;
  notify2_customer_name: string;
  notify2_customer_address: string;
  notify2_customer_email: string;
  cha_code: string;
  cha_address_id: number;

  // Commodity Details
  is_hazardous: boolean;
  commodity_description: string;
  marks_no: string;
  cargo_details: CargoDetail[];

  // Pickup Details
  pickup_location: string;
  pickup_from_code: string;
  pickup_address_id: string;
  planned_pickup_date: Date;
  actual_pickup_date: Date | null;
  transporter_code: string;
  transporter_name: string;
  transporter_email: string;

  // Delivery Details
  delivery_location: string;
  delivery_from_code: string;
  delivery_address_id: string;
  planned_delivery_date: Date;
  actual_delivery_date: Date | null;
  // Events, Documents, Trigger Updates (action menu)
  events: Array<{ type: string; date: string }>;
  document_ids: number[];
  /** Display list for documents (name + file name + url) until submit */
  document_display_list: Array<{
    id: number;
    documentName: string;
    doc_code?: string;
    userFileName?: string;
    document_url?: string;
  }>;
  trigger_updates: Array<{
    id?: number;
    type: string;
    code: string;
    description: string;
  }>;
  // Modal rows for Events / Documents / Trigger Updates (dynamic rows in modals)
  event_modal_rows: Array<{ eventType: string | null; eventDate: Date | null }>;
  document_modal_rows: Array<{
    id?: number;
    documentName: string;
    doc_code?: string;
    file: File | null;
    userFileName?: string;
    document_url?: string;
  }>;
  trigger_modal_rows: Array<{
    id?: number;
    type: string | null;
    code: string | null;
    description: string;
  }>;
}

// Yup validation schema
const validationSchema = yup.object({
  // Export Shipment fields - Only these are required
  customer_code: yup.string().trim().required("Customer is required"),
  service_code: yup.string().trim().required("Service is required"),
  date: yup.date().required("Date is required"),
  origin_code: yup.string().trim().required("Origin is required"),
  destination_code: yup
    .string()
    .trim()
    .required("Destination is required")
    .notOneOf(
      [yup.ref("origin_code")],
      "Origin and destination cannot be same",
    ),
  shipment_terms_code: yup
    .string()
    .trim()
    .required("Shipment terms are required"),
  freight: yup.string().trim().required("Freight is required"),
  routed: yup.string().trim().required("Routed is required"),
  routed_by: yup.string().trim().required("Routed by is required"),
  customer_service_name: yup
    .string()
    .trim()
    .required("Customer service name is required"),
  bill_no: yup.string().trim().nullable().notRequired(),
  bill_date: yup.date().nullable().notRequired(),
  iata: yup.string().trim().nullable().notRequired(),
  is_direct: yup.boolean(),
  is_coload: yup.boolean(),
  etd: yup.date().nullable().required("ETD is required"),
  eta: yup.date().nullable().required("ETA is required"),

  // Routing Details - All optional
  routingDetails: yup
    .array()
    .of(
      yup.object({
        move_type: yup.string(),
        from_location_code: yup.string(),
        to_location_code: yup.string(),
        etd: yup.date().nullable(),
        eta: yup.date().nullable(),
        carrier_code: yup.string(),
        flight_no: yup.string().nullable(),
        status: yup.string(),
        from_location_name: yup.string(),
        to_location_name: yup.string(),
        carrier_name: yup.string(),
      }),
    )
    .min(1, "At least one routing leg required"),

  // Party Details fields - All optional
  shipper_code: yup.string(),
  shipper_address_id: yup.number(),
  shipper_email: yup
    .string()
    .email("Invalid email format")
    .nullable()
    .notRequired(),
  consignee_code: yup.string(),
  consignee_address_id: yup.number(),
  consignee_email: yup
    .string()
    .email("Invalid email format")
    .nullable()
    .notRequired(),
  forwarder_code: yup.string(),
  forwarder_address_id: yup.number(),
  forwarder_email: yup
    .string()
    .email("Invalid email format")
    .nullable()
    .notRequired(),
  destination_agent_code: yup.string().nullable(),
  destination_agent_address_id: yup.number().nullable(),
  destination_agent_email: yup
    .string()
    .email("Invalid email format")
    .nullable()
    .notRequired(),
  billing_customer_code: yup.string(),
  billing_customer_address_id: yup.number(),
  notify1_customer_name: yup.string(),
  notify1_customer_address: yup.string(),
  notify1_customer_email: yup
    .string()
    .email("Invalid email format")
    .nullable()
    .notRequired(),
  notify2_customer_name: yup.string(),
  notify2_customer_address: yup.string(),
  notify2_customer_email: yup
    .string()
    .email("Invalid email format")
    .nullable()
    .notRequired(),
  cha_code: yup.string(),
  cha_address_id: yup.number(),

  // Commodity Details - All optional
  is_hazardous: yup.boolean(),
  commodity_description: yup.string(),
  marks_no: yup.string(),
  cargo_details: yup.array().of(
    yup.object({
      no_of_packages: yup.number().when("$service", {
        is: (val: string) => val === "AIR" || val === "LCL",
        then: (schema) => schema.required("No of packages required"),
        otherwise: (schema) => schema.nullable(),
      }),
      package_type: yup.string().nullable(),
      gross_weight: yup.number().when("$service", {
        is: (val: string) => val === "AIR",
        then: (schema) => schema.required("Gross weight required"),
        otherwise: (schema) => schema.nullable(),
      }),
      container_type_code: yup.string().when("$service", {
        is: "FCL",
        then: (schema) => schema.required("Container type required"),
        otherwise: (schema) => schema.nullable(),
      }),
      no_of_containers: yup.number().when("$service", {
        is: "FCL",
        then: (schema) => schema.required("No of containers required"),
        otherwise: (schema) => schema.nullable(),
      }),
      volume_weight: yup.number().nullable(),
      chargeable_weight: yup.number().nullable(),
      volume: yup.number().nullable(),
      chargeable_volume: yup.number().nullable(),
    }),
  ),

  // Pickup Details - All optional (pickup_address_id is string per FormValues)
  pickup_location: yup.string(),
  pickup_from_code: yup.string(),
  pickup_address_id: yup.string(),
  planned_pickup_date: yup.date(),
  actual_pickup_date: yup.date().nullable(),
  transporter_code: yup.string(),
  transporter_name: yup.string(),
  transporter_email: yup
    .string()
    .email("Invalid email format")
    .nullable()
    .notRequired(),

  // Delivery Details - All optional (delivery_address_id is string per FormValues)
  delivery_location: yup.string(),
  delivery_from_code: yup.string(),
  delivery_address_id: yup.string(),
  planned_delivery_date: yup
    .date()
    .min(yup.ref("planned_pickup_date"), "Delivery must be after pickup"),
  // Events, Documents, Trigger Updates - optional
  events: yup
    .array()
    .of(yup.object({ type: yup.string(), date: yup.string() })),
  document_ids: yup.array().of(yup.number()),
  trigger_updates: yup.array().of(
    yup.object({
      type: yup.string(),
      code: yup.string(),
      description: yup.string(),
    }),
  ),
});

// Data fetching functions
const fetchTermsOfShipment = async () => {
  const response = await getAPICall(`${URL.termsOfShipment}`, API_HEADER);
  return response;
};

const fetchContainerType = async () => {
  const response = await getAPICall(`${URL.containerType}`, API_HEADER);
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

const fetchTriggerMaster = async () => {
  const res = (await postAPICall(URL.triggerMaster, {}, API_HEADER)) as {
    data?: Array<{ code?: string }>;
  };
  const list = Array.isArray(res?.data) ? res.data : [];
  return list;
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

type QuotationCharge = {
  id: number;
  charge_id?: number | null;
  charge_name: string;
  pp_cc?: string | null;
  currency: string;
  roe: number;
  no_of_units: number;
  unit: string;
  sell_per_unit: number;
  min_sell: number;
  cost_per_unit: number;
  min_cost: number | null;
  total_cost: number;
  total_sell: number;
};

type QuotationItem = {
  quotation_id: string;
  service?: string;
  service_type?: string;
  charges: QuotationCharge[];
  is_booked?: boolean;
  booking_id?: number | null;
  booking_message?: string | null;
  shipment_code?: string | null;
};

type QuotationsResponse = {
  status: boolean;
  message: string;
  data: QuotationItem[];
};

type FilterGainedPayload =
  | {
      customer_code: string;
      origin_code: string;
      destination_code: string;
      service: string;
      service_type: string;
    }
  | { quotation_id: number };

const fetchQuotations = async (
  payload: FilterGainedPayload,
): Promise<QuotationsResponse> => {
  if ("quotation_id" in payload) {
    if (!payload.quotation_id) {
      return { status: false, message: "", data: [] };
    }
  } else {
    if (
      !payload.customer_code ||
      !payload.origin_code ||
      !payload.destination_code ||
      !payload.service ||
      !payload.service_type
    ) {
      return { status: false, message: "", data: [] };
    }
  }
  const response = (await postAPICall(
    URL.quotationFilterGained,
    payload,
    API_HEADER,
  )) as QuotationsResponse;
  return response;
};

// Helper function to get transport_mode based on move_type
const getTransportMode = (
  moveType: string | null | undefined,
): string | undefined => {
  if (!moveType) return undefined;
  const type = moveType.trim().toUpperCase();
  if (type === "AIR") return "AIR";
  if (type === "SEA") return "SEA";
  if (type === "ROAD" || type === "RAIL") return "LAND";
  return undefined;
};

const InlandImportBookingStepper: React.FC<ExportShipmentStepperProps> = ({
  onStepChange,
  onComplete,
  initialData,
  isEditMode = false,
  jobData,
  active: externalActive,
  setActive: externalSetActive,
  onQuotationAlreadyBooked,
  onEditFormPopulated,
}) => {
  const prevRoutedRef = useRef<string | null>(null);
  const customerServiceNameInitializedRef = useRef(false);
  const [internalActive, setInternalActive] = useState(0);

  // Use external active/setActive if provided, otherwise use internal state
  const active = externalActive !== undefined ? externalActive : internalActive;
  const setActive = externalSetActive || setInternalActive;
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [charges, setCharges] = useState<
    Array<{
      id?: number | null;
      charge_id: string | number;
      charge_name: string;
      pp_cc: string;
      currency_country_code: string;
      roe: number | "";
      unit: string;
      no_of_units: number | "";
      sell_per_unit: number | "";
      min_sell: number | "";
      cost_per_unit: number | "";
      total_cost: number | "";
      total_sell: number | "";
    }>
  >([
    {
      id: undefined,
      charge_id: "",
      charge_name: "",
      pp_cc: "Prepaid",
      ...getDefaultBookingChargeCurrencyFields(
        useAuthStore.getState().user?.branches,
      ),
      unit: "",
      no_of_units: "",
      sell_per_unit: "",
      min_sell: "",
      cost_per_unit: "",
      total_cost: "",
      total_sell: "",
    },
  ]);
  const [quotationId, setQuotationId] = useState("");

  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);

  // State for display values
  const [shipperDisplayName, setShipperDisplayName] = useState<string | null>(
    null,
  );
  const [pickupFromDisplayName, setPickupFromDisplayName] = useState<
    string | null
  >(null);
  const [deliveryFromDisplayName, setDeliveryFromDisplayName] = useState<
    string | null
  >(null);
  const [forwarderDisplayName, setForwarderDisplayName] = useState<
    string | null
  >(null);
  const [destinationAgentDisplayName, setDestinationAgentDisplayName] =
    useState<string | null>(null);
  const [billingCustomerDisplayName, setBillingCustomerDisplayName] = useState<
    string | null
  >(null);
  const [notifyCustomerDisplayName, setNotifyCustomerDisplayName] = useState<
    string | null
  >(null);
  const [notify2CustomerDisplayName, setNotify2CustomerDisplayName] = useState<
    string | null
  >(null);
  const [chaDisplayName, setChaDisplayName] = useState<string | null>(null);
  const [pickupAddressDisplayName, setPickupAddressDisplayName] = useState<
    string | null
  >(null);
  const [deliveryAddressDisplayName, setDeliveryAddressDisplayName] = useState<
    string | null
  >(null);

  // State for address options
  const [agentAddressOptions, setAgentAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [shipperAddressOptions, setShipperAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const shipperTypedNameRef = useRef("");
  const [forwarderAddressOptions, setForwarderAddressOptions] = useState<
    Array<{ value: string; label: string; email?: string }>
  >([]);
  const [chaAddressOptions, setChaAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [billingCustomerAddressOptions, setBillingCustomerAddressOptions] =
    useState<Array<{ value: string; label: string }>>([]);
  const [notifyCustomerAddressOptions, setNotifyCustomerAddressOptions] =
    useState<Array<{ value: string; label: string; email?: string }>>([]);
  const [notify2CustomerAddressOptions, setNotify2CustomerAddressOptions] =
    useState<Array<{ value: string; label: string; email?: string }>>([]);
  const [notifyCustomerAddressSearch, setNotifyCustomerAddressSearch] =
    useState("");
  const [notifyCustomerAddressCustom, setNotifyCustomerAddressCustom] =
    useState(false);
  const [notify2CustomerAddressSearch, setNotify2CustomerAddressSearch] =
    useState("");
  const [notify2CustomerAddressCustom, setNotify2CustomerAddressCustom] =
    useState(false);

  // Notify Customer 1 (shipment-party) - same pattern as Consignee
  const [notifyCustomerSearch, setNotifyCustomerSearch] = useState("");
  const [notifyCustomerOptions, setNotifyCustomerOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [notifyCustomerHasResults, setNotifyCustomerHasResults] = useState<
    boolean | null
  >(null);
  const [notifyCustomerIsSearching, setNotifyCustomerIsSearching] =
    useState(false);
  const [notifyCustomerSelectedId, setNotifyCustomerSelectedId] = useState("");
  const notifyCustomerDataRef = useRef<Record<string, Record<string, unknown>>>(
    {},
  );

  // Notify Customer 2 (shipment-party) - same pattern as Consignee
  const [notify2CustomerSearch, setNotify2CustomerSearch] = useState("");
  const [notify2CustomerOptions, setNotify2CustomerOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [notify2CustomerHasResults, setNotify2CustomerHasResults] = useState<
    boolean | null
  >(null);
  const [notify2CustomerIsSearching, setNotify2CustomerIsSearching] =
    useState(false);
  const [notify2CustomerSelectedId, setNotify2CustomerSelectedId] =
    useState("");
  const notify2CustomerDataRef = useRef<
    Record<string, Record<string, unknown>>
  >({});

  // Consignee (shipment-party) lookup: mirror city field behavior
  // - When API returns options, show searchable dropdown
  // - When API returns no options for search text, show plain text input
  const [consigneeSearch, setConsigneeSearch] = useState("");
  const [consigneeOptions, setConsigneeOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [consigneeHasResults, setConsigneeHasResults] = useState<
    boolean | null
  >(null);
  const [consigneeIsSearching, setConsigneeIsSearching] = useState(false);
  const consigneeDataRef = useRef<Record<string, Record<string, unknown>>>({});
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    Array<{ value: string; label: string; email?: string }>
  >([]);
  const [consigneeAddressSearch, setConsigneeAddressSearch] = useState("");
  const [consigneeAddressCustom, setConsigneeAddressCustom] = useState(false);

  const consigneeSelectRef = useRef<HTMLInputElement | null>(null);
  const consigneeTextRef = useRef<HTMLInputElement | null>(null);
  const notify1SelectRef = useRef<HTMLInputElement | null>(null);
  const notify1TextRef = useRef<HTMLInputElement | null>(null);
  const notify2SelectRef = useRef<HTMLInputElement | null>(null);
  const notify2TextRef = useRef<HTMLInputElement | null>(null);
  const forwarderEmailRef = useRef<HTMLInputElement | null>(null);

  const consigneeUseTextInput =
    consigneeHasResults === false && consigneeSearch.trim().length >= 2;
  const notify1UseTextInput =
    notifyCustomerHasResults === false &&
    notifyCustomerSearch.trim().length >= 2;
  const notify2UseTextInput =
    notify2CustomerHasResults === false &&
    notify2CustomerSearch.trim().length >= 2;

  const focusSoon = (el: HTMLInputElement | null) => {
    if (!el) return;
    setTimeout(() => el.focus(), 0);
  };

  useEffect(() => {
    focusSoon(
      consigneeUseTextInput
        ? consigneeTextRef.current
        : consigneeSelectRef.current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consigneeUseTextInput]);

  useEffect(() => {
    focusSoon(
      notify1UseTextInput ? notify1TextRef.current : notify1SelectRef.current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify1UseTextInput]);

  useEffect(() => {
    focusSoon(
      notify2UseTextInput ? notify2TextRef.current : notify2SelectRef.current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify2UseTextInput]);

  const defaultCurrency = (() => {
    const userData = localStorage.getItem("user");
    if (!userData) return "";

    const parsed = JSON.parse(userData);

    return (
      parsed?.branches?.find((b: any) => b.is_default)?.currency
        ?.currency_code || ""
    );
  })();

  const { data: inlandImportServices = [] } = useQuery({
    queryKey: ["serviceMaster", "inland_import"],
    queryFn: fetchInlandImportServices,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const inlandServiceOptions = useMemo(
    () =>
      inlandImportServices.map((item) => ({
        value: item.service_code,
        label: item.service_name || item.service_code,
      })),
    [inlandImportServices],
  );

  const resolvedServiceCode = String(
    jobData?.service_code ?? initialData?.service_code ?? "",
  ).trim();

  const { data: resolvedServiceByCode } = useQuery({
    queryKey: ["serviceMaster", "byCode", resolvedServiceCode],
    queryFn: () => fetchServiceMasterByCode(resolvedServiceCode),
    enabled: Boolean(resolvedServiceCode),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Data fetching queries
  const { data: termsOfShipment = [] } = useQuery({
    queryKey: ["tosData"],
    queryFn: fetchTermsOfShipment,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: fetchContainerType,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Currency master query
  const { data: currencyData = [] } = useQuery({
    queryKey: ["currencyMaster"],
    queryFn: fetchCurrencyMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Unit master query - fetch based on service type (AIR = AIR)
  const { data: unitDataRaw = [] } = useQuery({
    queryKey: ["unitMaster", "AIR"],
    queryFn: () => fetchUnitMaster("AIR"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Get user data from auth store
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const currencyAmountDecimalScale = getAmountDecimalScale(false);
  const localAmountDecimalScale = getAmountDecimalScale(isVietnamBranch);

  // Events master and Trigger Type master
  const { data: eventMasterData = [] } = useQuery({
    queryKey: ["eventMaster"],
    queryFn: fetchEventMaster,
    staleTime: 5 * 60 * 1000,
  });

  const { data: triggerMasterData = [] } = useQuery({
    queryKey: ["triggerMaster"],
    queryFn: fetchTriggerMaster,
    staleTime: 5 * 60 * 1000,
  });

  // Type for terms of shipment data
  type TermsOfShipmentData = {
    tos_code: string;
    tos_name: string;
    freight?: string;
  };

  // Memoized shipment options
  const shipmentOptions = useMemo(() => {
    if (!Array.isArray(termsOfShipment) || !termsOfShipment.length) return [];
    return termsOfShipment.map((item: TermsOfShipmentData) => ({
      value: item.tos_code ? String(item.tos_code) : "",
      label: `${item.tos_name} (${item.tos_code})`,
    }));
  }, [termsOfShipment]);

  const eventTypeOptions = useMemo(() => {
    const list = eventMasterData as Array<{ name?: string }>;
    if (!list?.length) return [];
    return list.map((item) => {
      const name = String(item.name ?? "");
      return {
        value: name,
        label: name,
      };
    });
  }, [eventMasterData]);

  // Trigger type has no master data ? static options
  const triggerTypeOptions = useMemo(
    () => [
      { value: "Customer", label: "Customer" },
      { value: "Agent", label: "Agent" },
    ],
    [],
  );

  const triggerCodeOptions = useMemo(() => {
    const list = triggerMasterData as Array<{ name?: string }>;
    if (!list?.length) return [];
    const names = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    list.forEach((item) => {
      const rawName = item.name;
      if (rawName == null || !String(rawName).trim()) return;
      const name = String(rawName);
      if (names.has(name)) return;
      names.add(name);
      options.push({ value: name, label: name });
    });
    return options;
  }, [triggerMasterData]);

  // Memoized container type options
  const containerTypeOptions = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];
    return rawContainerData.map((item: Record<string, unknown>) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: String(item.container_name || ""),
    }));
  }, [rawContainerData]);

  // Memoized currency options
  const currencyOptions = useMemo(() => {
    if (!Array.isArray(currencyData)) return [];
    return currencyData.map((item: { code?: string }) => ({
      value: String(item.code || ""),
      label: item.code || "",
    }));
  }, [currencyData]);

  const updateCharge = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    setCharges((prev) =>
      prev.map((charge, i) => {
        if (i === index) {
          const updatedCharge = { ...charge, [field]: value };

          if (field === "unit") {
            return applyBookingChargeUnitChange(
              updatedCharge,
              String(value),
              form.values.service,
              form.values.cargo_details,
              unitOptions,
            );
          }

          // Calculate totals when relevant fields change (row-level)
          if (
            field === "no_of_units" ||
            field === "unit" ||
            field === "sell_per_unit" ||
            field === "roe"
          ) {
            const noOfUnits = parseFloat(updatedCharge.no_of_units) || 0;
            const sellPerUnit = parseFloat(updatedCharge.sell_per_unit) || 0;
            const roe = parseFloat(updatedCharge.roe) || 1;

            updatedCharge.total_sell = formatMoneyAmountBound(
              noOfUnits * sellPerUnit * roe,
            );
          }

          if (
            field === "no_of_units" ||
            field === "unit" ||
            field === "cost_per_unit" ||
            field === "roe"
          ) {
            const noOfUnits = parseFloat(updatedCharge.no_of_units) || 0;
            const costPerUnit = parseFloat(updatedCharge.cost_per_unit) || 0;
            const roe = parseFloat(updatedCharge.roe) || 1;

            updatedCharge.total_cost = formatMoneyAmountBound(
              noOfUnits * costPerUnit * roe,
            );
          }

          return updatedCharge;
        }
        return charge;
      }),
    );
  };

  const addNewCharge = () => {
    const newCharge = {
      id: undefined as number | undefined,
      charge_id: "",
      charge_name: "",
      pp_cc: "Prepaid",
      ...getDefaultBookingChargeCurrencyFields(
        useAuthStore.getState().user?.branches,
      ),
      unit: "",
      no_of_units: "",
      sell_per_unit: "",
      min_sell: "",
      cost_per_unit: "",
      total_cost: "",
      total_sell: "",
    };
    setCharges((prev) => [...prev, newCharge]);
  };

  const removeCharge = (index: number) => {
    setCharges((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  const bookingRoe = useBookingChargesRoe(charges, setCharges);
  const { validateChargesRoe } = bookingRoe;

  // Function to map initial data to form values
  const mapInitialDataToFormValues = (
    data: Record<string, unknown>,
  ): Partial<FormValues> => {
    if (!data) return {};

    return {
      // Export Shipment fields
      customer_code: String(
        data.customer_code_read || data.customer_code || "",
      ),
      customer_name: String(data.customer_name || ""),
      service: String(data.service || "INLAND"),
      service_code: String(data.service_code || ""),
      service_name: String(data.service_name || ""),
      date:
        data.date && String(data.date) !== "" && String(data.date) !== "null"
          ? new Date(String(data.date))
          : new Date(),
      origin_code: String(data.origin_code_read || data.origin_code || ""),
      origin_name: String(data.origin_name || ""),
      destination_code: String(
        data.destination_code_read || data.destination_code || "",
      ),
      destination_name: String(data.destination_name || ""),
      shipment_terms_code: String(
        data.shipment_terms_code_read || data.shipment_terms_code || "",
      ),
      shipment_terms_name: String(data.shipment_terms_name || ""),
      freight:
        normalizeShipmentTermsFreight(data.freight) ||
        String(data.freight || ""),
      routed: String(data.routed || ""),
      routed_by: String(data.routed_by || ""),
      customer_service_name: String(data.customer_service_name || ""),
      bill_no: String(data.bill_no ?? ""),
      bill_date:
        data.bill_date &&
        String(data.bill_date) !== "" &&
        String(data.bill_date) !== "null"
          ? new Date(String(data.bill_date))
          : null,
      iata: String(data.iata ?? ""),
      is_direct: Boolean(data.is_direct),
      is_coload: Boolean(data.is_coload),
      eta: data.eta ? new Date(String(data.eta)) : null,
      etd: data.etd ? new Date(String(data.etd)) : null,

      // Routing Details - map from routing_details array
      routingDetails: data.routing_details
        ? (data.routing_details as Array<Record<string, unknown>>).map(
            (route: Record<string, unknown>) => ({
              id: route.id
                ? typeof route.id === "number"
                  ? route.id
                  : Number(route.id)
                : undefined,
              move_type: String(route.move_type || ""),
              etd: route.etd ? new Date(String(route.etd)) : null,
              eta: route.eta ? new Date(String(route.eta)) : null,
              from_location_code: route.from_location_code || "",
              to_location_code: route.to_location_code || "",
              carrier_code: route.carrier_code || "",
              from_location_name: route.from_location_name || "",
              to_location_name: route.to_location_name || "",
              carrier_name: route.carrier_name || "",
              flight_no: route.flight_no ? String(route.flight_no) : null,
              status: String(route.status || ""),
            }),
          )
        : [],

      // Party Details fields - map from the provided data structure
      // Check for both _read and regular versions to handle API response format
      shipper_code: String(data.shipper_code_read || data.shipper_code || ""),
      shipper_name: String(data.shipper_name || ""),
      shipper_address: String(
        data.shipper_address || data.shipper_address_text || "",
      ),
      shipper_address_id: Number(data.shipper_address_id) || 0,
      shipper_email: String(data.shipper_email || ""),
      consignee_code: String(
        data.consignee_code_read || data.consignee_code || "",
      ),
      consignee_name: String(data.consignee_name || ""),
      consignee_address_id: Number(data.consignee_address_id) || 0,
      consignee_address: String(
        data.consignee_address || data.consignee_address_text || "",
      ),
      consignee_email: String(data.consignee_email || ""),
      forwarder_code: String(
        data.forwarder_code_read || data.forwarder_code || "",
      ),
      forwarder_address_id: Number(data.forwarder_address_id) || 0,
      forwarder_address: String(data.forwarder_address || ""),
      forwarder_email: String(data.forwarder_email || ""),
      destination_agent_code: String(
        data.destination_agent_code_read || data.destination_agent_code || "",
      ),
      destination_agent_address_id:
        Number(data.destination_agent_address_id) || 0,
      destination_agent_email: String(data.destination_agent_email || ""),
      billing_customer_code: String(
        data.billing_customer_code_read || data.billing_customer_code || "",
      ),
      billing_customer_address_id:
        Number(data.billing_customer_address_id) || 0,
      notify1_customer_name: String(
        data.notify1_customer_name ?? data.notify_customer_name ?? "",
      ),
      notify1_customer_address: String(
        data.notify1_customer_address ?? data.notify_customer_address ?? "",
      ),
      notify1_customer_email: String(
        data.notify1_customer_email ?? data.notify_customer_email ?? "",
      ),
      notify2_customer_name: String(data.notify2_customer_name ?? ""),
      notify2_customer_address: String(data.notify2_customer_address ?? ""),
      notify2_customer_email: String(data.notify2_customer_email ?? ""),
      cha_code: String(data.cha_code_read || data.cha_code || ""),
      cha_address_id: Number(data.cha_address_id) || 0,

      // Commodity Details
      is_hazardous: Boolean(data.is_hazardous),
      commodity_description: String(data.commodity_description || ""),
      marks_no: String(data.marks_no || ""),
      cargo_details: data.cargo_details
        ? (data.cargo_details as Array<Record<string, unknown>>).map(
            (cargo: Record<string, unknown>) => ({
              id: cargo.id
                ? typeof cargo.id === "number"
                  ? cargo.id
                  : Number(cargo.id)
                : undefined,
              no_of_packages: cargo.no_of_packages
                ? Number(cargo.no_of_packages)
                : undefined,
              package_type: pickPackageTypeCodeFromCargo(cargo),
              gross_weight: cargo.gross_weight
                ? parseFloat(String(cargo.gross_weight))
                : undefined,
              volume_weight: cargo.volume_weight
                ? parseFloat(String(cargo.volume_weight))
                : undefined,
              chargeable_weight: cargo.chargeable_weight
                ? parseFloat(String(cargo.chargeable_weight))
                : undefined,
              volume: cargo.volume
                ? parseFloat(String(cargo.volume))
                : undefined,
              chargeable_volume: cargo.chargeable_volume
                ? parseFloat(String(cargo.chargeable_volume))
                : undefined,
              container_type_code: cargo.container_type_code
                ? String(cargo.container_type_code)
                : undefined,
              no_of_containers: cargo.no_of_containers
                ? Number(cargo.no_of_containers)
                : undefined,
            }),
          )
        : [
            {
              no_of_packages: undefined,
              package_type: "",
              gross_weight: undefined,
              volume_weight: undefined,
              chargeable_weight: undefined,
              volume: undefined,
              chargeable_volume: undefined,
              container_type_code: undefined,
              no_of_containers: undefined,
            },
          ],

      // Pickup Details
      pickup_location: String(data.pickup_location || ""),
      pickup_from_code: String(data.pickup_from_code || ""),
      pickup_address_id: String(data.pickup_address_id || ""),
      planned_pickup_date: data.planned_pickup_date
        ? new Date(String(data.planned_pickup_date))
        : new Date(),
      actual_pickup_date: data.actual_pickup_date
        ? new Date(String(data.actual_pickup_date))
        : null,
      transporter_code: String(data.transporter_code || ""),
      transporter_name: String(data.transporter_name || ""),
      transporter_email: String(data.transporter_email || ""),

      // Delivery Details
      delivery_location: String(data.delivery_location || ""),
      delivery_from_code: String(data.delivery_from_code || ""),
      delivery_address_id: String(data.delivery_address_id || ""),
      planned_delivery_date: data.planned_delivery_date
        ? new Date(String(data.planned_delivery_date))
        : new Date(),
      actual_delivery_date: data.actual_delivery_date
        ? new Date(String(data.actual_delivery_date))
        : null,

      // Events, Documents, Trigger Updates
      events: Array.isArray(data.events)
        ? (data.events as Array<{ type?: string; date?: string }>).map((e) => ({
            type: String(e.type ?? ""),
            date: String(e.date ?? ""),
          }))
        : [],
      document_ids: parseJobDocumentsFromApi(data as Record<string, unknown>)
        .document_ids,
      document_display_list: parseJobDocumentsFromApi(
        data as Record<string, unknown>,
      ).document_display_list,
      trigger_updates: Array.isArray(data.trigger_updates)
        ? (
            data.trigger_updates as Array<{
              id?: number;
              type?: string;
              code?: string;
              description?: string;
            }>
          ).map((t) => ({
            id: t.id != null ? Number(t.id) : undefined,
            type: String(t.type ?? ""),
            code: String(t.code ?? ""),
            description: String(t.description ?? ""),
          }))
        : [],
      document_modal_rows: parseJobDocumentsFromApi(
        data as Record<string, unknown>,
      ).document_modal_rows,
      trigger_modal_rows: Array.isArray(data.trigger_updates)
        ? (
            data.trigger_updates as Array<{
              id?: number;
              type?: string;
              code?: string;
              description?: string;
            }>
          ).map((t) => ({
            id: t.id != null ? Number(t.id) : undefined,
            type: t.type ? String(t.type) : null,
            code: t.code ? String(t.code) : null,
            description: String(t.description ?? ""),
          }))
        : [{ id: undefined, type: null, code: null, description: "" }],
    };
  };

  const form = useForm<FormValues>({
    validate: yupResolver(validationSchema) as unknown as (
      values: FormValues,
    ) => Record<string, string>,
    validateInputOnBlur: true,
    validateInputOnChange: false,
    initialValues: {
      // Export Shipment fields
      customer_code: "",
      customer_name: "",
      service: "INLAND",
      service_code: "",
      service_name: "",
      date: new Date(),
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      shipment_terms_code: "",
      shipment_terms_name: "",
      freight: "",
      routed: "Self",
      routed_by: "",
      customer_service_name: "",
      bill_no: "",
      bill_date: null,
      iata: "",
      is_direct: false,
      is_coload: false,
      etd: null,
      eta: null,

      // Routing Details - start with one empty row
      routingDetails: [
        {
          move_type: "",
          etd: null,
          eta: null,
          carrier_code: "",
          from_location_code: "",
          to_location_code: "",
          carrier_name: "",
          from_location_name: "",
          to_location_name: "",
          flight_no: null,
          status: "",
        },
      ],

      // Party Details fields
      shipper_code: "",
      shipper_name: "",
      shipper_address: "",
      shipper_address_id: 0,
      shipper_email: "",
      consignee_code: "",
      consignee_name: "",
      consignee_address_id: 0,
      consignee_address: "",
      consignee_email: "",
      forwarder_code: "",
      forwarder_address_id: 0,
      forwarder_address: "",
      forwarder_email: "",
      destination_agent_code: "",
      destination_agent_address_id: 0,
      destination_agent_email: "",
      billing_customer_code: "",
      billing_customer_address_id: 0,
      notify1_customer_name: "",
      notify1_customer_address: "",
      notify1_customer_email: "",
      notify2_customer_name: "",
      notify2_customer_address: "",
      notify2_customer_email: "",
      cha_code: "",
      cha_address_id: 0,

      // Commodity Details
      is_hazardous: false,
      commodity_description: "",
      marks_no: "",
      cargo_details: [
        {
          no_of_packages: undefined,
          package_type: "",
          gross_weight: undefined,
          volume_weight: undefined,
          chargeable_weight: undefined,
          volume: undefined,
          chargeable_volume: undefined,
          container_type_code: undefined,
          no_of_containers: undefined,
        },
      ],

      // Pickup Details
      pickup_location: "",
      pickup_from_code: "",
      pickup_address_id: "",
      planned_pickup_date: new Date(),
      actual_pickup_date: null,
      transporter_code: "",
      transporter_name: "",
      transporter_email: "",

      // Delivery Details
      delivery_location: "",
      delivery_from_code: "",
      delivery_address_id: "",
      planned_delivery_date: new Date(),
      actual_delivery_date: null,

      // Events, Documents, Trigger Updates
      events: [],
      document_ids: [],
      document_display_list: [],
      trigger_updates: [],
      event_modal_rows: [{ eventType: null, eventDate: null }],
      document_modal_rows: [
        {
          id: undefined,
          documentName: "",
          doc_code: "",
          file: null,
          userFileName: "",
        },
      ],
      trigger_modal_rows: [
        { id: undefined, type: null, code: null, description: "" },
      ],

      // Merge with initial data when provided (edit mode or create-from-quotation)
      ...(initialData ? mapInitialDataToFormValues(initialData) : {}),
    },
  });

  const bookingDocuments = useBookingPageDocuments((state) => {
    form.setFieldValue("document_ids", state.document_ids);
    form.setFieldValue("document_display_list", state.document_display_list);
  });

  useEffect(() => {
    if (!initialData) return;
    bookingDocuments.initFromJobData(initialData as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync documents once from initial booking data
  }, []);

  const unitOptions = useMemo(
    () => buildBookingUnitOptions(unitDataRaw),
    [unitDataRaw],
  );

  useEffect(() => {
    if (!resolvedServiceByCode?.service_code) return;
    form.setFieldValue("service_code", resolvedServiceByCode.service_code);
    form.setFieldValue(
      "service_name",
      resolvedServiceByCode.service_name || resolvedServiceByCode.service_code,
    );
  }, [
    resolvedServiceByCode?.service_code,
    resolvedServiceByCode?.service_name,
  ]);

  useEffect(() => {
    if (!unitOptions.length) return;
    setCharges(
      (prev) =>
        mapBookingChargesWithUnits(
          prev,
          form.values.service,
          form.values.cargo_details,
          unitOptions,
        ) ?? prev,
    );
  }, [unitOptions, form.values.service, form.values.cargo_details]);

  // Debug: Log the final form values
  console.log("Final form initialValues:", form.values);
  console.log(
    "Mapped initial data:",
    isEditMode && initialData
      ? mapInitialDataToFormValues(initialData)
      : "Not in edit mode",
  );

  // Events, Documents, Trigger Updates ? form-based handlers
  const addEventRow = () => {
    form.insertListItem("event_modal_rows", {
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
    const toAdd: BookingEvent[] = [];
    for (const row of rows) {
      if (row.eventType && row.eventDate) {
        toAdd.push({
          type: row.eventType,
          date:
            row.eventDate instanceof Date
              ? row.eventDate.toISOString().split("T")[0]
              : String(row.eventDate),
        });
      }
    }
    if (toAdd.length === 0) {
      ToastNotification({
        type: "warning",
        message: "Please add at least one event with type and date",
      });
      return;
    }
    // Replace existing events with the current modal rows (edit full list)
    form.setFieldValue("events", toAdd);
    form.setFieldValue("event_modal_rows", [
      { eventType: null, eventDate: null },
    ]);
    setEventsModalOpen(false);
  };

  const addTriggerRow = () => {
    form.insertListItem("trigger_modal_rows", {
      id: undefined,
      type: null,
      code: null,
      description: "",
    });
  };

  const updateTriggerRow = (
    index: number,
    field: "type" | "code" | "description",
    value: string | null,
  ) => {
    form.setFieldValue(`trigger_modal_rows.${index}.${field}`, value ?? "");
  };

  const removeTriggerRow = (index: number) => {
    const rows = form.values.trigger_modal_rows;
    if (rows.length === 1) {
      form.setFieldValue("trigger_modal_rows", [
        { id: undefined, type: null, code: null, description: "" },
      ]);
    } else {
      form.removeListItem("trigger_modal_rows", index);
    }
  };

  const handleSubmitTriggerModal = () => {
    const rows = form.values.trigger_modal_rows;
    const toAdd: {
      id?: number;
      type: string;
      code: string;
      description: string;
    }[] = [];
    for (const row of rows) {
      if (row.type && row.code) {
        const item: {
          id?: number;
          type: string;
          code: string;
          description: string;
        } = {
          type: row.type,
          code: row.code,
          description: row.description.trim(),
        };
        if (row.id != null) {
          item.id = typeof row.id === "number" ? row.id : Number(row.id);
        }
        toAdd.push(item);
      }
    }
    if (toAdd.length === 0) {
      ToastNotification({
        type: "warning",
        message: "Please add at least one trigger with type and code",
      });
      return;
    }
    form.setFieldValue("trigger_updates", toAdd);
    setTriggerModalOpen(false);
  };

  // Salespersons data query - must be after form initialization
  const { data: rawSalespersonsData = [] } = useQuery({
    queryKey: ["salespersons", form.values.customer_code || ""],
    queryFn: () => fetchSalespersons(""),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    enabled: true,
  });

  // When customer is selected, customer API may return assigned_to_display; we add it to routed-by options so we can set routed_by
  const [assignedToDisplayFromCustomer, setAssignedToDisplayFromCustomer] =
    useState<string | null>(null);

  // Format salespersons data
  const salespersonsData = useMemo(() => {
    const response = rawSalespersonsData as SalespersonsResponse;
    const options =
      response?.data && Array.isArray(response.data) && response.data.length
        ? response.data.map((item: SalespersonData) => ({
            value: item.sales_person ? String(item.sales_person) : "",
            label: item.sales_person,
            sales_coordinator: item.sales_coordinator || "",
            customer_service: item.customer_service || "",
          }))
        : [];

    // Ensure edit-mode routed_by value is present in options so the dropdown shows it
    if (isEditMode && initialData?.routed_by) {
      const routedByValue = String(initialData.routed_by);
      const exists = options.some((opt) => opt.value === routedByValue);
      if (!exists) {
        options.unshift({
          value: routedByValue,
          label: routedByValue,
          sales_coordinator: "",
          customer_service: String(initialData.customer_service_name || ""),
        });
      }
    }

    // When customer is selected, add assigned_to_display from customer response so routed_by can show it
    if (
      assignedToDisplayFromCustomer &&
      assignedToDisplayFromCustomer.trim() !== ""
    ) {
      const exists = options.some(
        (opt) => opt.value === assignedToDisplayFromCustomer,
      );
      if (!exists) {
        options.unshift({
          value: assignedToDisplayFromCustomer,
          label: assignedToDisplayFromCustomer,
          sales_coordinator: "",
          customer_service: "",
        });
      }
    }

    // Create flow: ensure logged-in user is in options so "Routed By" can default to them
    if (!isEditMode && user?.full_name?.trim()) {
      const userDisplay = user.full_name.trim();
      const exists = options.some((opt) => opt.value === userDisplay);
      if (!exists) {
        options.unshift({
          value: userDisplay,
          label: userDisplay,
          sales_coordinator: "",
          customer_service: "",
        });
      }
    }

    return options;
  }, [
    rawSalespersonsData,
    isEditMode,
    initialData,
    assignedToDisplayFromCustomer,
    user?.full_name,
  ]);

  // quotation_primary_id when creating from quotation page (for filter-gained API)
  const quotationPrimaryId = initialData?.quotation_primary_id
    ? Number(initialData.quotation_primary_id)
    : null;
  const isFromQuotationFlow = !!quotationPrimaryId;

  // Fetch quotations: Flow 1 (create new) - customer/origin/destination/service; Flow 2 (from quotation) - quotation_id
  const { data: quotationsData } = useQuery<QuotationsResponse>({
    queryKey: isFromQuotationFlow
      ? ["quotations", "byQuotation", quotationPrimaryId]
      : [
          "quotations",
          form.values.customer_code,
          form.values.origin_code,
          form.values.destination_code,
          form.values.service_code,
        ],
    queryFn: () =>
      isFromQuotationFlow
        ? fetchQuotations({ quotation_id: quotationPrimaryId! })
        : fetchQuotations({
            customer_code: form.values.customer_code,
            origin_code: form.values.origin_code,
            destination_code: form.values.destination_code,
            service: form.values.service_code,
            service_type: "Import",
          }),
    enabled: isFromQuotationFlow
      ? !!quotationPrimaryId
      : !!form.values.customer_code &&
        !!form.values.origin_code &&
        !!form.values.destination_code &&
        !!form.values.service_code,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Memoized quotation options
  const quotationOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];

    // Add options from fetched quotations data
    if (
      quotationsData &&
      quotationsData?.status &&
      Array.isArray(quotationsData?.data)
    ) {
      quotationsData.data.forEach((item: QuotationItem) => {
        options.push({
          value: String(item.quotation_id || ""),
          label: String(item.quotation_id || ""),
        });
      });
    }

    // In edit mode or create-from-quotation, ensure the quotation_id from initialData is in options
    if ((isEditMode || isFromQuotationFlow) && initialData?.quotation_id) {
      const quotationIdValue = String(initialData.quotation_id);
      const exists = options.some((opt) => opt.value === quotationIdValue);
      if (!exists) {
        options.unshift({
          value: quotationIdValue,
          label: quotationIdValue,
        });
      }
    }

    return options;
  }, [quotationsData, isEditMode, initialData, isFromQuotationFlow]);

  // Quotation flow: when is_booked false set charges; when is_booked true fetch existing booking
  const lastBookedIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      !isFromQuotationFlow ||
      !quotationsData?.status ||
      !Array.isArray(quotationsData.data) ||
      quotationsData.data.length === 0 ||
      !onQuotationAlreadyBooked
    ) {
      return;
    }
    const firstItem = quotationsData.data[0] as QuotationItem;
    if (firstItem.is_booked === true && firstItem.booking_id) {
      const bookingId = Number(firstItem.booking_id);
      if (lastBookedIdRef.current === bookingId) return;
      lastBookedIdRef.current = bookingId;
      onQuotationAlreadyBooked(
        firstItem.booking_message ||
          "This quotation is already linked to a booking.",
        bookingId,
      );
    } else if (firstItem.is_booked !== true && firstItem.charges?.length) {
      lastBookedIdRef.current = null;
      setQuotationId(String(firstItem.quotation_id || ""));
      const mappedCharges = firstItem.charges.map(
        (charge: QuotationCharge) => ({
          id: undefined as number | undefined,
          charge_id: charge.charge_id != null ? String(charge.charge_id) : "",
          charge_name: String(charge.charge_name || ""),
          pp_cc: charge.pp_cc ? String(charge.pp_cc) : "Prepaid",
          currency_country_code: String(charge.currency || ""),
          roe: charge.roe ? String(charge.roe) : "",
          unit: String(charge.unit || ""),
          no_of_units: charge.no_of_units ? String(charge.no_of_units) : "",
          sell_per_unit: charge.sell_per_unit
            ? String(charge.sell_per_unit)
            : "",
          min_sell: charge.min_sell ? String(charge.min_sell) : "",
          cost_per_unit: charge.cost_per_unit
            ? String(charge.cost_per_unit)
            : "",
          total_cost: charge.total_cost ? String(charge.total_cost) : "",
          total_sell: charge.total_sell ? String(charge.total_sell) : "",
        }),
      );
      setCharges(
        mapBookingChargesWithUnits(
          mappedCharges,
          form.values.service,
          form.values.cargo_details,
          unitOptions,
        ) ?? mappedCharges,
      );
    }
  }, [
    isFromQuotationFlow,
    quotationsData,
    onQuotationAlreadyBooked,
    unitOptions,
    form.values.service,
    form.values.cargo_details,
  ]);

  // Debounced consignee search that hits shipment-party/ endpoint and
  // fills dropdown options, similar to the City field logic.
  const debouncedConsigneeSearch = useDebouncedCallback(
    async (term: string) => {
      const query = term.trim();
      if (!query || query.length < 2) {
        setConsigneeOptions([]);
        setConsigneeHasResults(null);
        setConsigneeIsSearching(false);
        consigneeDataRef.current = {};
        return;
      }

      try {
        setConsigneeIsSearching(true);
        setConsigneeHasResults(null);
        const results = await commonSearchAPI({
          endpoint: URL.shipmentParty,
          query,
        });

        const arr = Array.isArray(results)
          ? (results as Record<string, unknown>[])
          : [];

        if (!arr.length) {
          setConsigneeOptions([]);
          setConsigneeHasResults(false);
          form.setFieldValue("consignee_name", toTitleCase(query));
          form.setFieldValue("consignee_code", "");
          form.setFieldValue("consignee_address", "");
          form.setFieldValue("consignee_address_id", 0);
          form.setFieldValue("consignee_email", "");
          consigneeDataRef.current = {};
          return;
        }

        const { options: opts, map } = mapShipmentPartySearchResults(arr);
        consigneeDataRef.current = map;
        setConsigneeOptions(opts);
        setConsigneeHasResults(true);
      } catch (error) {
        console.error("Consignee shipment-party search failed:", error);
        setConsigneeOptions([]);
        setConsigneeHasResults(null);
        consigneeDataRef.current = {};
      } finally {
        setConsigneeIsSearching(false);
      }
    },
    300,
  );

  // Debounced notify customer 1 search - same API as consignee
  const debouncedNotifyCustomerSearch = useDebouncedCallback(
    async (term: string) => {
      const query = term.trim();
      if (!query || query.length < 2) {
        setNotifyCustomerOptions([]);
        setNotifyCustomerHasResults(null);
        setNotifyCustomerIsSearching(false);
        setNotifyCustomerAddressOptions([]);
        notifyCustomerDataRef.current = {};
        return;
      }
      try {
        setNotifyCustomerIsSearching(true);
        setNotifyCustomerHasResults(null);
        const results = await commonSearchAPI({
          endpoint: URL.shipmentParty,
          query,
        });
        const arr = Array.isArray(results)
          ? (results as Record<string, unknown>[])
          : [];
        if (!arr.length) {
          setNotifyCustomerOptions([]);
          setNotifyCustomerHasResults(false);
          setNotifyCustomerAddressOptions([]);
          form.setFieldValue("notify1_customer_name", toTitleCase(query));
          form.setFieldValue("notify1_customer_address", "");
          form.setFieldValue("notify1_customer_email", "");
          notifyCustomerDataRef.current = {};
          return;
        }
        const { options: opts, map } = mapShipmentPartySearchResults(arr);
        notifyCustomerDataRef.current = map;
        setNotifyCustomerOptions(opts);
        setNotifyCustomerHasResults(true);
      } catch (error) {
        console.error("Notify customer 1 shipment-party search failed:", error);
        setNotifyCustomerOptions([]);
        setNotifyCustomerHasResults(null);
        notifyCustomerDataRef.current = {};
      } finally {
        setNotifyCustomerIsSearching(false);
      }
    },
    300,
  );

  // Debounced notify customer 2 search - same API as consignee
  const debouncedNotify2CustomerSearch = useDebouncedCallback(
    async (term: string) => {
      const query = term.trim();
      if (!query || query.length < 2) {
        setNotify2CustomerOptions([]);
        setNotify2CustomerHasResults(null);
        setNotify2CustomerIsSearching(false);
        setNotify2CustomerAddressOptions([]);
        notify2CustomerDataRef.current = {};
        return;
      }
      try {
        setNotify2CustomerIsSearching(true);
        setNotify2CustomerHasResults(null);
        const results = await commonSearchAPI({
          endpoint: URL.shipmentParty,
          query,
        });
        const arr = Array.isArray(results)
          ? (results as Record<string, unknown>[])
          : [];
        if (!arr.length) {
          setNotify2CustomerOptions([]);
          setNotify2CustomerHasResults(false);
          setNotify2CustomerAddressOptions([]);
          form.setFieldValue("notify2_customer_name", toTitleCase(query));
          form.setFieldValue("notify2_customer_address", "");
          form.setFieldValue("notify2_customer_email", "");
          notify2CustomerDataRef.current = {};
          return;
        }
        const { options: opts, map } = mapShipmentPartySearchResults(arr);
        notify2CustomerDataRef.current = map;
        setNotify2CustomerOptions(opts);
        setNotify2CustomerHasResults(true);
      } catch (error) {
        console.error("Notify customer 2 shipment-party search failed:", error);
        setNotify2CustomerOptions([]);
        setNotify2CustomerHasResults(null);
        notify2CustomerDataRef.current = {};
      } finally {
        setNotify2CustomerIsSearching(false);
      }
    },
    300,
  );

  // Track which job we've populated from - run only once per job to avoid overwriting user edits
  const populatedJobIdRef = useRef<number | null>(null);

  // Effect to load edit data when jobData is available (runs ONCE per job)
  useEffect(() => {
    if (!isEditMode || !jobData) return;
    const jobId =
      jobData.id != null
        ? typeof jobData.id === "number"
          ? jobData.id
          : Number(jobData.id)
        : null;
    if (jobId != null && populatedJobIdRef.current === jobId) return;
    if (jobId != null) populatedJobIdRef.current = jobId;

    const mappedData = mapInitialDataToFormValues(jobData);
    form.setValues(mappedData as FormValues);
    bookingDocuments.initFromJobData(jobData as Record<string, unknown>);

    if (jobData.shipper_name)
      setShipperDisplayName(String(jobData.shipper_name));
    if (jobData.consignee_name) {
      const name = String(jobData.consignee_name);
      form.setFieldValue("consignee_name", name);
      form.setFieldValue("consignee_code", name);
      setConsigneeSearch(name);
      setConsigneeOptions([{ value: name, label: name }]);
      consigneeDataRef.current[name] = { customer_name: name };
    }
    if (jobData.consignee_address) {
      const addr = String(jobData.consignee_address);
      form.setFieldValue("consignee_address", addr);
      setConsigneeAddressOptions([
        {
          value: addr,
          label: addr,
          email: String(jobData.consignee_email || ""),
        },
      ]);
      setConsigneeAddressSearch(addr);
      setConsigneeAddressCustom(false);
    } else if (jobData.consignee_address_text) {
      const addr = String(jobData.consignee_address_text);
      form.setFieldValue("consignee_address", addr);
      setConsigneeAddressOptions([
        {
          value: addr,
          label: addr,
          email: String(jobData.consignee_email || ""),
        },
      ]);
      setConsigneeAddressSearch(addr);
      setConsigneeAddressCustom(false);
    }
    if (jobData.forwarder_name)
      setForwarderDisplayName(String(jobData.forwarder_name));
    if (jobData.destination_agent_name)
      setDestinationAgentDisplayName(String(jobData.destination_agent_name));
    if (jobData.billing_customer_name)
      setBillingCustomerDisplayName(String(jobData.billing_customer_name));
    else if (jobData.billing_customer)
      setBillingCustomerDisplayName(String(jobData.billing_customer));
    if (jobData.notify1_customer_name) {
      const name = String(jobData.notify1_customer_name);
      setNotifyCustomerDisplayName(name);
      setNotifyCustomerSearch(name);
      setNotifyCustomerOptions([{ value: name, label: name }]);
      setNotifyCustomerSelectedId(name);
      notifyCustomerDataRef.current[name] = { customer_name: name };
      setNotifyCustomerAddressOptions(
        jobData.notify1_customer_address
          ? [
              {
                value: String(jobData.notify1_customer_address),
                label: String(jobData.notify1_customer_address),
                email: String(jobData.notify1_customer_email || ""),
              },
            ]
          : [],
      );
      if (jobData.notify1_customer_address) {
        setNotifyCustomerAddressSearch(
          String(jobData.notify1_customer_address),
        );
        setNotifyCustomerAddressCustom(false);
      }
    } else if (jobData.notify_customer_name) {
      const name = String(jobData.notify_customer_name);
      setNotifyCustomerDisplayName(name);
      setNotifyCustomerSearch(name);
    } else if (jobData.notify_customer) {
      setNotifyCustomerDisplayName(String(jobData.notify_customer));
      setNotifyCustomerSearch(String(jobData.notify_customer));
    }
    if (jobData.notify2_customer_name) {
      const name = String(jobData.notify2_customer_name);
      setNotify2CustomerDisplayName(name);
      setNotify2CustomerSearch(name);
      setNotify2CustomerOptions([{ value: name, label: name }]);
      setNotify2CustomerSelectedId(name);
      notify2CustomerDataRef.current[name] = { customer_name: name };
      setNotify2CustomerAddressOptions(
        jobData.notify2_customer_address
          ? [
              {
                value: String(jobData.notify2_customer_address),
                label: String(jobData.notify2_customer_address),
                email: String(jobData.notify2_customer_email || ""),
              },
            ]
          : [],
      );
      if (jobData.notify2_customer_address) {
        setNotify2CustomerAddressSearch(
          String(jobData.notify2_customer_address),
        );
        setNotify2CustomerAddressCustom(false);
      }
    }
    if (jobData.cha_name) setChaDisplayName(String(jobData.cha_name));
    else if (jobData.cha) setChaDisplayName(String(jobData.cha));
    if (jobData.pickup_from)
      setPickupFromDisplayName(
        jobData.pickup_from_code
          ? `${String(jobData.pickup_from)} (${String(jobData.pickup_from_code)})`
          : String(jobData.pickup_from),
      );
    if (jobData.delivery_from)
      setDeliveryFromDisplayName(
        jobData.delivery_from_code
          ? `${String(jobData.delivery_from)} (${String(jobData.delivery_from_code)})`
          : String(jobData.delivery_from),
      );
    if (jobData.pickup_address_text || jobData.pickup_address)
      setPickupAddressDisplayName(
        String(jobData.pickup_address_text ?? jobData.pickup_address ?? ""),
      );
    if (jobData.delivery_address_text || jobData.delivery_address)
      setDeliveryAddressDisplayName(
        String(jobData.delivery_address_text ?? jobData.delivery_address ?? ""),
      );

    if (jobData.shipper_address) {
      const addrId = jobData.shipper_address_id;
      const hasRealId = addrId != null && Number(addrId) !== 0;
      const resolvedId = hasRealId ? Number(addrId) : -1;

      setShipperAddressOptions([
        { value: String(resolvedId), label: String(jobData.shipper_address) },
      ]);
      form.setFieldValue("shipper_address_id", resolvedId);
      form.setFieldValue("shipper_address", String(jobData.shipper_address));
    }
    // Consignee address is handled as text for shipment-party flow
    if (jobData.forwarder_address_id != null && jobData.forwarder_address) {
      setForwarderAddressOptions([
        {
          value: String(jobData.forwarder_address_id),
          label: String(jobData.forwarder_address),
          email: String(jobData.forwarder_email || ""),
        },
      ]);
    }
    if (
      jobData.destination_agent_address_id != null &&
      jobData.destination_agent_address
    ) {
      setAgentAddressOptions([
        {
          value: String(jobData.destination_agent_address_id),
          label: String(jobData.destination_agent_address),
        },
      ]);
    }
    if (
      jobData.billing_customer_address_id != null &&
      jobData.billing_customer_address
    ) {
      setBillingCustomerAddressOptions([
        {
          value: String(jobData.billing_customer_address_id),
          label: String(jobData.billing_customer_address),
        },
      ]);
    }
    if (
      jobData.notify1_customer_address &&
      notifyCustomerAddressOptions.length === 0 &&
      !jobData.notify1_customer_name
    ) {
      const addr = String(jobData.notify1_customer_address);
      setNotifyCustomerAddressOptions([
        {
          value: addr,
          label: addr,
          email: String(jobData.notify1_customer_email || ""),
        },
      ]);
      setNotifyCustomerAddressSearch(addr);
      setNotifyCustomerAddressCustom(false);
    }
    if (jobData.cha_address_id != null && jobData.cha_address) {
      setChaAddressOptions([
        {
          value: String(jobData.cha_address_id),
          label: String(jobData.cha_address),
        },
      ]);
    }
    if (jobData.quotation_id) setQuotationId(String(jobData.quotation_id));
    if (
      jobData.rate_details &&
      Array.isArray(jobData.rate_details) &&
      jobData.rate_details.length > 0
    ) {
      const mappedCharges = (
        jobData.rate_details as Array<Record<string, unknown>>
      ).map((charge: Record<string, unknown>) => ({
        id:
          charge.id != null
            ? typeof charge.id === "number"
              ? charge.id
              : Number(charge.id)
            : undefined,
        charge_id: charge.charge_id != null ? String(charge.charge_id) : "",
        charge_name: String(charge.charge_name ?? ""),
        pp_cc: String(charge.pp_cc ?? "Prepaid"),
        currency_country_code: String(
          charge.currency_country_code ?? charge.currency ?? "",
        ),
        roe: charge.roe != null ? String(charge.roe) : "",
        unit: String(charge.unit ?? ""),
        no_of_units:
          charge.no_of_units != null ? String(charge.no_of_units) : "",
        sell_per_unit:
          charge.sell_per_unit != null ? String(charge.sell_per_unit) : "",
        min_sell: charge.min_sell != null ? String(charge.min_sell) : "",
        cost_per_unit:
          charge.cost_per_unit != null ? String(charge.cost_per_unit) : "",
        total_cost: charge.total_cost != null ? String(charge.total_cost) : "",
        total_sell: charge.total_sell != null ? String(charge.total_sell) : "",
      }));
      setCharges(
        mapBookingChargesWithUnits(
          mappedCharges,
          form.values.service,
          form.values.cargo_details,
          unitOptions,
        ) ?? mappedCharges,
      );
    }

    queueMicrotask(() => {
      onEditFormPopulated?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form excluded to prevent re-running on user edits
  }, [isEditMode, jobData, onEditFormPopulated]);

  // Effect to set up display names when initialData is provided (skip in edit mode with jobData)
  useEffect(() => {
    if (!initialData || (isEditMode && jobData)) return;

    console.log("Setting up display names from initialData:", initialData);

    // Set display names for SearchableSelect components
    if (initialData.shipper_name) {
      setShipperDisplayName(String(initialData.shipper_name));
    }
    if (initialData.consignee_name) {
      const name = String(initialData.consignee_name);
      form.setFieldValue("consignee_name", name);
      form.setFieldValue("consignee_code", name);
      setConsigneeSearch(name);
      setConsigneeOptions([{ value: name, label: name }]);
      consigneeDataRef.current[name] = { customer_name: name };
    }
    if (initialData.consignee_address) {
      const addr = String(initialData.consignee_address);
      form.setFieldValue("consignee_address", addr);
      setConsigneeAddressOptions([
        {
          value: addr,
          label: addr,
          email: String(initialData.consignee_email || ""),
        },
      ]);
      setConsigneeAddressSearch(addr);
      setConsigneeAddressCustom(false);
    } else if (initialData.consignee_address_text) {
      const addr = String(initialData.consignee_address_text);
      form.setFieldValue("consignee_address", addr);
      setConsigneeAddressOptions([
        {
          value: addr,
          label: addr,
          email: String(initialData.consignee_email || ""),
        },
      ]);
      setConsigneeAddressSearch(addr);
      setConsigneeAddressCustom(false);
    }
    if (initialData.forwarder_name) {
      setForwarderDisplayName(String(initialData.forwarder_name));
    }
    if (initialData.destination_agent_name) {
      setDestinationAgentDisplayName(
        String(initialData.destination_agent_name),
      );
    }
    // Billing Customer - check for both billing_customer_name and billing_customer
    if (initialData.billing_customer_name) {
      setBillingCustomerDisplayName(String(initialData.billing_customer_name));
    } else if (initialData.billing_customer) {
      setBillingCustomerDisplayName(String(initialData.billing_customer));
    }
    // Notify Customer 1
    if (initialData.notify1_customer_name) {
      const name = String(initialData.notify1_customer_name);
      setNotifyCustomerDisplayName(name);
      setNotifyCustomerSearch(name);
      setNotifyCustomerOptions([{ value: name, label: name }]);
      setNotifyCustomerSelectedId(name);
      notifyCustomerDataRef.current[name] = { customer_name: name };
      if (initialData.notify1_customer_address) {
        const addr = String(initialData.notify1_customer_address);
        setNotifyCustomerAddressOptions([
          {
            value: addr,
            label: addr,
            email: String(initialData.notify1_customer_email || ""),
          },
        ]);
        setNotifyCustomerAddressSearch(addr);
        setNotifyCustomerAddressCustom(false);
      }
    } else if (initialData.notify_customer_name) {
      const name = String(initialData.notify_customer_name);
      setNotifyCustomerDisplayName(name);
      setNotifyCustomerSearch(name);
    } else if (initialData.notify_customer) {
      setNotifyCustomerDisplayName(String(initialData.notify_customer));
      setNotifyCustomerSearch(String(initialData.notify_customer));
    }
    // Notify Customer 2
    if (initialData.notify2_customer_name) {
      const name = String(initialData.notify2_customer_name);
      setNotify2CustomerDisplayName(name);
      setNotify2CustomerSearch(name);
      setNotify2CustomerOptions([{ value: name, label: name }]);
      setNotify2CustomerSelectedId(name);
      notify2CustomerDataRef.current[name] = { customer_name: name };
      if (initialData.notify2_customer_address) {
        const addr = String(initialData.notify2_customer_address);
        setNotify2CustomerAddressOptions([
          {
            value: addr,
            label: addr,
            email: String(initialData.notify2_customer_email || ""),
          },
        ]);
        setNotify2CustomerAddressSearch(addr);
        setNotify2CustomerAddressCustom(false);
      }
    }
    // CHA - check for both cha_name and cha
    if (initialData.cha_name) {
      setChaDisplayName(String(initialData.cha_name));
    } else if (initialData.cha) {
      setChaDisplayName(String(initialData.cha));
    }

    // Set Pickup From display name - check for both pickup_from and pickup_from_name
    if (initialData.pickup_from) {
      const pickupFromName = String(initialData.pickup_from);
      const pickupFromCode = initialData.pickup_from_code
        ? String(initialData.pickup_from_code)
        : "";
      setPickupFromDisplayName(
        pickupFromCode
          ? `${pickupFromName} (${pickupFromCode})`
          : pickupFromName,
      );
    } else if (initialData.pickup_from_name) {
      setPickupFromDisplayName(String(initialData.pickup_from_name));
    }

    // Set Delivery From display name - check for both delivery_from and delivery_from_name
    if (initialData.delivery_from) {
      const deliveryFromName = String(initialData.delivery_from);
      const deliveryFromCode = initialData.delivery_from_code
        ? String(initialData.delivery_from_code)
        : "";
      setDeliveryFromDisplayName(
        deliveryFromCode
          ? `${deliveryFromName} (${deliveryFromCode})`
          : deliveryFromName,
      );
    } else if (initialData.delivery_from_name) {
      setDeliveryFromDisplayName(String(initialData.delivery_from_name));
    }

    if (initialData.pickup_address_text || initialData.pickup_address) {
      setPickupAddressDisplayName(
        String(
          initialData.pickup_address_text || initialData.pickup_address || "",
        ),
      );
    }
    if (initialData.delivery_address_text || initialData.delivery_address) {
      setDeliveryAddressDisplayName(
        String(
          initialData.delivery_address_text ||
            initialData.delivery_address ||
            "",
        ),
      );
    }

    // Populate address options from response data for Party Details
    // Shipper Address
    // Shipper Address (from quotation list address string or with id)
    if (initialData.shipper_address) {
      setShipperAddressOptions([
        {
          value: String(initialData.shipper_address_id || 0),
          label: String(initialData.shipper_address),
        },
      ]);
      form.setFieldValue(
        "shipper_address_id",
        Number(initialData.shipper_address_id) || 0,
      );
    }

    // Consignee address is handled as text for shipment-party flow

    // Forwarder Address
    if (initialData.forwarder_address_id && initialData.forwarder_address) {
      setForwarderAddressOptions([
        {
          value: String(initialData.forwarder_address_id),
          label: String(initialData.forwarder_address),
          email: String(initialData.forwarder_email || ""),
        },
      ]);
    }

    // Destination Agent Address
    if (
      initialData.destination_agent_address_id &&
      initialData.destination_agent_address
    ) {
      setAgentAddressOptions([
        {
          value: String(initialData.destination_agent_address_id),
          label: String(initialData.destination_agent_address),
        },
      ]);
    }

    // Billing Customer Address
    if (
      initialData.billing_customer_address_id &&
      initialData.billing_customer_address
    ) {
      setBillingCustomerAddressOptions([
        {
          value: String(initialData.billing_customer_address_id),
          label: String(initialData.billing_customer_address),
        },
      ]);
    }

    // Notify Customer 1 address options when we have address but didn't set from name (e.g. legacy)
    if (
      initialData.notify1_customer_address &&
      !initialData.notify1_customer_name
    ) {
      const addr = String(initialData.notify1_customer_address);
      setNotifyCustomerAddressOptions([
        {
          value: addr,
          label: addr,
          email: String(initialData.notify1_customer_email || ""),
        },
      ]);
      setNotifyCustomerAddressSearch(addr);
      setNotifyCustomerAddressCustom(false);
    }
    // Notify Customer 2 address options when we have address but didn't set from name
    if (
      initialData.notify2_customer_address &&
      !initialData.notify2_customer_name
    ) {
      const addr = String(initialData.notify2_customer_address);
      setNotify2CustomerAddressOptions([
        {
          value: addr,
          label: addr,
          email: String(initialData.notify2_customer_email || ""),
        },
      ]);
      setNotify2CustomerAddressSearch(addr);
      setNotify2CustomerAddressCustom(false);
    }

    // CHA Address
    if (initialData.cha_address_id && initialData.cha_address) {
      setChaAddressOptions([
        {
          value: String(initialData.cha_address_id),
          label: String(initialData.cha_address),
        },
      ]);
    }

    // Set quotation ID
    if (initialData.quotation_id) {
      setQuotationId(String(initialData.quotation_id));
    }

    // Set up charges from rate_details (priority) or quotation_charges
    let chargesData = null;
    if (
      initialData.rate_details &&
      Array.isArray(initialData.rate_details) &&
      initialData.rate_details.length > 0
    ) {
      chargesData = initialData.rate_details;
    } else if (
      initialData.quotation_charges &&
      Array.isArray(initialData.quotation_charges)
    ) {
      chargesData = initialData.quotation_charges;
    }

    if (chargesData) {
      const mappedCharges = (chargesData as Array<Record<string, unknown>>).map(
        (charge: Record<string, unknown>) => {
          const nestedCharge = charge.charge as
            Record<string, unknown> | undefined;
          const chargeName =
            charge.charge_name || nestedCharge?.charge_name || "";
          return {
            id:
              charge.id != null
                ? typeof charge.id === "number"
                  ? charge.id
                  : Number(charge.id)
                : undefined,
            charge_id: charge.charge_id != null ? String(charge.charge_id) : "",
            charge_name: String(chargeName),
            pp_cc: String(charge.pp_cc ?? "Prepaid"),
            currency_country_code: String(
              charge.currency_country_code || charge.currency || "",
            ),
            roe: charge.roe ? String(charge.roe) : "",
            unit: String(charge.unit || ""),
            no_of_units: charge.no_of_units ? String(charge.no_of_units) : "",
            sell_per_unit: charge.sell_per_unit
              ? String(charge.sell_per_unit)
              : "",
            min_sell: charge.min_sell ? String(charge.min_sell) : "",
            cost_per_unit: charge.cost_per_unit
              ? String(charge.cost_per_unit)
              : "",
            total_cost: charge.total_cost ? String(charge.total_cost) : "",
            total_sell: charge.total_sell ? String(charge.total_sell) : "",
          };
        },
      );
      setCharges(
        mapBookingChargesWithUnits(
          mappedCharges,
          form.values.service,
          form.values.cargo_details,
          unitOptions,
        ) ?? mappedCharges,
      );
    }
  }, [isEditMode, initialData, jobData]);

  // Effect to populate routing codes from initialData (edit or create-from-quotation)
  useEffect(() => {
    if (
      initialData &&
      initialData.routing_details &&
      Array.isArray(initialData.routing_details)
    ) {
      const routingDetails = initialData.routing_details as Array<
        Record<string, unknown>
      >;
      // Ensure form has the same number of routing details as initialData
      if (form.values.routingDetails.length === routingDetails.length) {
        routingDetails.forEach(
          (route: Record<string, unknown>, index: number) => {
            // Populate codes from route data (even if empty string, to ensure they're set)
            form.setFieldValue(
              `routingDetails.${index}.from_location_code`,
              route.from_location_code ? String(route.from_location_code) : "",
            );
            form.setFieldValue(
              `routingDetails.${index}.to_location_code`,
              route.to_location_code ? String(route.to_location_code) : "",
            );
            form.setFieldValue(
              `routingDetails.${index}.carrier_code`,
              route.carrier_code ? String(route.carrier_code) : "",
            );
          },
        );
      }
    }
  }, [isEditMode, initialData, form.values.routingDetails.length]);

  // Set customer_service_name to logged-in user once in create mode (never when routed_by is selected)
  useEffect(() => {
    if (
      isEditMode ||
      !user?.full_name ||
      customerServiceNameInitializedRef.current
    )
      return;
    if (form.values.customer_service_name !== "") return;
    form.setFieldValue("customer_service_name", user.full_name);
    customerServiceNameInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, user?.full_name, form.values.customer_service_name]);

  // Create flow only: when Routed is "Self" and no customer selected, default Routed By to logged-in user (edit flow uses initialData).
  useEffect(() => {
    if (
      isEditMode ||
      form.values.routed !== "Self" ||
      assignedToDisplayFromCustomer
    )
      return;
    if (!user?.full_name?.trim()) return;
    const name = user.full_name.trim();
    if (form.values.routed_by !== name) {
      form.setFieldValue("routed_by", name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    form.values.routed,
    assignedToDisplayFromCustomer,
    user?.full_name,
  ]);

  // When user switches Routed to "Agent", clear routed_by (not on initial load).
  useEffect(() => {
    if (
      prevRoutedRef.current !== null &&
      prevRoutedRef.current !== form.values.routed &&
      form.values.routed === "Agent"
    ) {
      form.setFieldValue("routed_by", "");
    }
    prevRoutedRef.current = form.values.routed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.routed]);

  // Calculate chargeable volume for LCL service
  const calculateChargeableVolume = useCallback(
    (grossWeight: number | null, volume: number | null): number => {
      if (!grossWeight && !volume) return 0;
      const grossWeightInCbm = grossWeight ? grossWeight / 1000 : 0;
      const volumeInCbm = volume || 0;
      return Math.max(grossWeightInCbm, volumeInCbm);
    },
    [],
  );

  // Calculate chargeable weight for AIR service (max of gross weight and volume weight)
  const calculateChargeableWeight = useCallback(
    (grossWeight: number | null, volumeWeight: number | null): number => {
      if (!grossWeight && !volumeWeight) return 0;
      const gross = grossWeight || 0;
      const volume = volumeWeight || 0;
      return Math.max(gross, volume);
    },
    [],
  );

  // Debounced function to update chargeable volume and chargeable weight
  const debouncedUpdateChargeableValues = useDebouncedCallback(() => {
    const cargo = form.values.cargo_details[0];
    if (!cargo) return;

    if (form.values.service === "LCL") {
      const grossWeight = Number(cargo.gross_weight) || null;
      const volume = Number(cargo.volume) || null;

      if (grossWeight || volume) {
        const chargeableVolume = calculateChargeableVolume(grossWeight, volume);
        if (cargo.chargeable_volume !== chargeableVolume) {
          form.setFieldValue(
            "cargo_details.0.chargeable_volume",
            chargeableVolume,
          );
        }
      } else {
        if (cargo.chargeable_volume !== null) {
          form.setFieldValue("cargo_details.0.chargeable_volume", null);
        }
      }
      // Clear chargeable weight when service is LCL
      if (cargo.chargeable_weight !== null) {
        form.setFieldValue("cargo_details.0.chargeable_weight", null);
      }
    } else if (
      form.values.service === "AIR" ||
      form.values.service === "INLAND"
    ) {
      const grossWeight = Number(cargo.gross_weight) || null;
      const volumeWeight = Number(cargo.volume_weight) || null;

      if (grossWeight || volumeWeight) {
        const chargeableWeight = calculateChargeableWeight(
          grossWeight,
          volumeWeight,
        );
        if (cargo.chargeable_weight !== chargeableWeight) {
          form.setFieldValue(
            "cargo_details.0.chargeable_weight",
            chargeableWeight,
          );
        }
      } else {
        if (cargo.chargeable_weight !== null) {
          form.setFieldValue("cargo_details.0.chargeable_weight", null);
        }
      }
      // Clear chargeable volume when service is AIR
      if (cargo.chargeable_volume !== null) {
        form.setFieldValue("cargo_details.0.chargeable_volume", null);
      }
    } else {
      // Clear chargeable values when service is neither LCL nor AIR
      if (cargo.chargeable_volume !== null) {
        form.setFieldValue("cargo_details.0.chargeable_volume", null);
      }
      if (cargo.chargeable_weight !== null) {
        form.setFieldValue("cargo_details.0.chargeable_weight", null);
      }
    }
  }, 300);

  // Track cargo values for recalculation
  const cargoValuesKey = useMemo(() => {
    const cargo = form.values.cargo_details[0];
    if (!cargo) return "empty";
    return `${form.values.service}:${cargo.gross_weight || 0}:${cargo.volume_weight || 0}:${cargo.volume || 0}`;
  }, [form.values.service, form.values.cargo_details]);

  // Recalculate chargeable values when cargo inputs change
  useEffect(() => {
    debouncedUpdateChargeableValues();
  }, [cargoValuesKey, debouncedUpdateChargeableValues]);

  const cargoNoOfUnitsSyncKey = useMemo(
    () =>
      buildBookingCargoNoOfUnitsSyncKey(
        form.values.service,
        form.values.cargo_details,
      ),
    [form.values.service, form.values.cargo_details],
  );

  useEffect(() => {
    if (!form.values.service) return;

    setCharges((prev) => {
      const updated = syncBookingChargesWithCargoNoOfUnits(
        prev as Parameters<typeof syncBookingChargesWithCargoNoOfUnits>[0],
        form.values.service,
        form.values.cargo_details,
        unitOptions,
        {
          preserveExistingNoOfUnits:
            Boolean(quotationId) || isFromQuotationFlow,
        },
      );
      return updated ? (updated as typeof prev) : prev;
    });
  }, [
    cargoNoOfUnitsSyncKey,
    form.values.service,
    unitOptions,
    quotationId,
    isFromQuotationFlow,
  ]);

  const handleSubmit = async () => {
    try {
      // Set loading state
      setIsSubmitting(true);

      // Validate only the required fields before submission
      const requiredFields = [
        "customer_code",
        "service",
        "date",
        "origin_code",
        "destination_code",
        "shipment_terms_code",
        "freight",
        "routed",
        "routed_by",
        "customer_service_name",
        "etd",
        "eta",
      ];

      const validation = form.validate();
      console.log("validation check---", validation);

      // Check if any required fields have errors
      const hasRequiredFieldErrors = requiredFields.some(
        (field) => validation.errors[field],
      );

      const hasRoutingDateErrors = Object.keys(validation.errors).some(
        (key) =>
          key.startsWith("routingDetails") &&
          (key.endsWith(".etd") || key.endsWith(".eta")),
      );

      if (hasRequiredFieldErrors || hasRoutingDateErrors) {
        console.log(
          "Required fields have validation errors:",
          validation.errors,
        );
        ToastNotification({
          type: "error",
          message: "Please fill in all required fields before submitting.",
        });
        setIsSubmitting(false);
        return;
      }

      if (!validateChargesRoe()) {
        setIsSubmitting(false);
        return;
      }

      // Helper function to format dates to YYYY-MM-DD (using local timezone to avoid day shift)
      const formatDate = (dateValue: Date | string | null | undefined) => {
        if (!dateValue) return "";
        let date: Date;
        if (typeof dateValue === "string") {
          date = new Date(dateValue);
        } else if (dateValue instanceof Date) {
          date = dateValue;
        } else {
          return "";
        }
        // Use local timezone to avoid day shift issue
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const formatDateOrNull = (
        dateValue: Date | string | null | undefined,
      ) => {
        if (!dateValue) return null;
        const formatted = formatDate(dateValue);
        return formatted || null;
      };

      // Transform form data to match API payload structure
      const payload: Record<string, unknown> = {
        customer_code: form.values.customer_code,
        service: "INLAND",
        service_type: "IMPORT",
        service_code: form.values.service_code,
        // service_name: form.values.service_name,
        date: formatDate(form.values.date),
        origin_code: form.values.origin_code,
        destination_code: form.values.destination_code,
        shipment_terms_code: form.values.shipment_terms_code,
        freight: form.values.freight,
        routed: form.values.routed,
        routed_by: form.values.routed_by,
        customer_service_name: form.values.customer_service_name,
        bill_no: form.values.bill_no?.trim() || null,
        bill_date: form.values.bill_date
          ? formatDate(form.values.bill_date)
          : null,
        iata: form.values.iata?.trim() || null,
        is_direct: form.values.is_direct,
        is_coload: form.values.is_coload,
        eta: formatDateOrNull(form.values.eta),
        etd: formatDateOrNull(form.values.etd),

        shipper_name: form.values.shipper_name,
        shipper_address: form.values.shipper_address,
        shipper_email: form.values.shipper_email,

        consignee_name: form.values.consignee_name,
        consignee_address: form.values.consignee_address,
        consignee_email: form.values.consignee_email,

        forwarder_code: form.values.forwarder_code,
        forwarder_name: forwarderDisplayName || "",
        forwarder_address_id:
          form.values.forwarder_address_id &&
          form.values.forwarder_address_id > 0
            ? Number(form.values.forwarder_address_id)
            : null,
        forwarder_address: form.values.forwarder_address || "",
        forwarder_email: form.values.forwarder_email,

        destination_agent_code: form.values.destination_agent_code,
        destination_agent_address_id:
          form.values.destination_agent_address_id &&
          form.values.destination_agent_address_id > 0
            ? Number(form.values.destination_agent_address_id)
            : null,
        destination_agent_email: form.values.destination_agent_email,

        billing_customer_code: form.values.billing_customer_code,
        billing_customer_address_id:
          form.values.billing_customer_address_id &&
          form.values.billing_customer_address_id > 0
            ? Number(form.values.billing_customer_address_id)
            : null,

        notify1_customer_name: form.values.notify1_customer_name || null,
        notify1_customer_address: form.values.notify1_customer_address || null,
        notify1_customer_email: form.values.notify1_customer_email || null,
        notify2_customer_name: form.values.notify2_customer_name || null,
        notify2_customer_address: form.values.notify2_customer_address || null,
        notify2_customer_email: form.values.notify2_customer_email || null,

        cha_code: form.values.cha_code,
        cha_address_id:
          form.values.cha_address_id && form.values.cha_address_id > 0
            ? Number(form.values.cha_address_id)
            : null,

        // Events, Documents, Trigger Updates
        document_ids: form.values.document_ids,
        events: form.values.events,
        trigger_updates: form.values.trigger_updates,

        is_hazardous: form.values.is_hazardous,
        commodity_description: form.values.commodity_description,
        marks_no: form.values.marks_no,
        cargo_details: form.values.cargo_details.map((cargo) => {
          const cargoPayload: Record<string, unknown> = {
            no_of_packages: cargo.no_of_packages || null,
            package_type_code:
              pickPackageTypeCodeFromCargo(
                cargo as unknown as Record<string, unknown>,
              ) || null,
            gross_weight: roundToDecimals(cargo.gross_weight, 3) || null,
            volume_weight: roundToDecimals(cargo.volume_weight, 3) || null,
            chargeable_weight:
              roundToDecimals(cargo.chargeable_weight, 3) || null,
            volume: roundToDecimals(cargo.volume, 3) || null,
            chargeable_volume:
              roundToDecimals(cargo.chargeable_volume, 3) || null,
            container_type_code: cargo.container_type_code || null,
            no_of_containers: cargo.no_of_containers || null,
          };
          if (isEditMode && cargo.id !== undefined && cargo.id !== null) {
            cargoPayload.id =
              typeof cargo.id === "number" ? cargo.id : Number(cargo.id);
          }
          return cargoPayload;
        }),

        pickup_location: form.values.pickup_location,
        pickup_from_code: form.values.pickup_from_code,
        pickup_address_id:
          form.values.pickup_address_id &&
          form.values.pickup_address_id !== "" &&
          Number(form.values.pickup_address_id) > 0
            ? Number(form.values.pickup_address_id)
            : null,
        planned_pickup_date: formatDate(form.values.planned_pickup_date),
        actual_pickup_date: form.values.actual_pickup_date
          ? formatDate(form.values.actual_pickup_date)
          : null,
        transporter_code: form.values.transporter_code,
        transporter_name: form.values.transporter_name,
        transporter_email: form.values.transporter_email,

        delivery_location: form.values.delivery_location,
        delivery_from_code: form.values.delivery_from_code,
        delivery_address_id:
          form.values.delivery_address_id &&
          form.values.delivery_address_id !== "" &&
          Number(form.values.delivery_address_id) > 0
            ? Number(form.values.delivery_address_id)
            : null,
        planned_delivery_date: formatDate(form.values.planned_delivery_date),
        actual_delivery_date: form.values.actual_delivery_date
          ? formatDate(form.values.actual_delivery_date)
          : null,

        routing_details: form.values.routingDetails.map((route) => {
          const routePayload: Record<string, unknown> = {
            move_type: route.move_type,
            from_location_code: route.from_location_code || null,
            to_location_code: route.to_location_code || null,
            etd: formatDate(route.etd),
            eta: formatDate(route.eta),
            carrier_code: route.carrier_code || null,
            flight_no: route.flight_no,
            status: route.status,
          };
          // Include id only in edit mode if it exists
          if (isEditMode && route.id !== undefined && route.id !== null) {
            routePayload.id =
              typeof route.id === "number" ? route.id : Number(route.id);
          }
          return routePayload;
        }),

        quotation_id: quotationId,
        rate_details: charges.map((charge) => {
          const chargePayload: Record<string, unknown> = {
            charge_id: charge.charge_id ? Number(charge.charge_id) : null,
            // charge_name: charge.charge_name,
            pp_cc: charge.pp_cc || "",
            currency_country_code: charge.currency_country_code,
            roe: roundRoeForPayload(charge.roe) ?? 1,
            unit: charge.unit,
            no_of_units: parseNoOfUnitForPayload(charge.no_of_units) ?? 0,
            sell_per_unit:
              roundMoneyToDecimals(parseFloat(charge.sell_per_unit)) || 0,
            min_sell: roundMoneyToDecimals(parseFloat(charge.min_sell)) || 0,
            cost_per_unit:
              roundMoneyToDecimals(parseFloat(charge.cost_per_unit)) || 0,
            total_cost:
              roundLocalMoneyToDecimals(parseFloat(charge.total_cost)) || 0,
            total_sell:
              roundLocalMoneyToDecimals(parseFloat(charge.total_sell)) || 0,
          };
          // Only attach id when it was received from filter endpoint; do not send generated values
          if (charge.id != null && charge.id !== undefined) {
            chargePayload.id =
              typeof charge.id === "number" ? charge.id : Number(charge.id);
          }
          return chargePayload;
        }),
      };

      payload.import_to_export = false;

      // Include id for edit mode
      if (isEditMode && jobData?.id) {
        payload.id =
          typeof jobData.id === "number" ? jobData.id : Number(jobData.id);
      }

      if (isEditMode) {
        // Use PUT API for edit mode
        await putAPICall("customer-service-shipment/", payload, API_HEADER);
      } else {
        // Use POST API for create mode
        await postAPICall("customer-service-shipment/", payload, API_HEADER);
      }

      // Navigate back to Inland Import Booking master page with refresh flag
      navigate("../", { state: { refreshData: true } });

      // Show success notification immediately after navigation
      ToastNotification({
        type: "success",
        message: `Import shipment ${isEditMode ? "updated" : "created"} successfully!`,
      });

      // Also call onComplete if provided
      onComplete?.();
    } catch (error) {
      console.error("Error submitting import shipment:", error);
      ToastNotification({
        type: "error",
        message: `Failed to ${isEditMode ? "update" : "create"} import shipment. Please try again.`,
      });
    } finally {
      // Reset loading state
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (active < 4) {
      const nextStep = active + 1;
      setActive(nextStep);
      onStepChange?.(nextStep);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (active > 0) {
      const prevStep = active - 1;
      setActive(prevStep);
      onStepChange?.(prevStep);
    }
  };

  const addRoutingDetail = () => {
    form.insertListItem("routingDetails", {
      move_type: "",
      from_location_code: "",
      to_location_code: "",
      etd: null,
      eta: null,
      carrier_code: "",
      flight_no: null,
      status: "",
    });
  };

  const removeRoutingDetail = (index: number) => {
    form.removeListItem("routingDetails", index);
  };

  console.log(
    "PARENT VALUE:",
    form.values.routingDetails[0]?.from_location_name,
  );

  return (
    <>
      {/* Events modal - single heading row, multiple data rows */}
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
            <Grid key={index} align="flex-end" gutter="sm">
              <Grid.Col span={5}>
                <Select
                  placeholder="Select event type"
                  data={eventTypeOptions}
                  searchable
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
            <Button onClick={handleSubmitEventsModal}>Add Events</Button>
          </Group>
        </Stack>
      </Modal>

      <JobDocumentsModal
        opened={bookingDocuments.documentsModalOpen}
        onClose={() => bookingDocuments.setDocumentsModalOpen(false)}
        rows={bookingDocuments.document_modal_rows}
        uploading={bookingDocuments.documentUploading}
        docTypeOptions={bookingDocuments.docTypeOptions}
        docCodeErrors={bookingDocuments.docCodeErrors}
        onAddRow={bookingDocuments.addDocumentRow}
        onUpdateRow={bookingDocuments.updateDocumentRow}
        onRemoveRow={bookingDocuments.removeDocumentRow}
        onSubmit={bookingDocuments.handleSubmitDocumentsModal}
      />

      {/* Trigger Update modal */}
      <Modal
        opened={triggerModalOpen}
        onClose={() => setTriggerModalOpen(false)}
        title="Trigger Update"
        centered
        size="70vw"
      >
        <Stack gap="md">
          {form.values.trigger_modal_rows.length > 0 && (
            <Grid
              columns={12}
              gutter="sm"
              style={{ fontWeight: 600, color: "#105476" }}
            >
              <Grid.Col span={3}>
                <RequiredLabel label="Type" required={false} />
              </Grid.Col>
              <Grid.Col span={3}>
                <RequiredLabel label="Code" required={false} />
              </Grid.Col>
              <Grid.Col span={5}>
                <RequiredLabel label="Description" required={false} />
              </Grid.Col>
              <Grid.Col span={1}>
                <RequiredLabel label="Actions" required={false} />
              </Grid.Col>
            </Grid>
          )}
          {form.values.trigger_modal_rows.map((row, index) => (
            <Grid key={index} columns={12} gutter="sm" align="flex-end">
              <Grid.Col span={3}>
                <Select
                  placeholder="Select type"
                  data={triggerTypeOptions}
                  value={row.type}
                  onChange={(value) =>
                    updateTriggerRow(index, "type", value ?? null)
                  }
                  searchable
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Select
                  placeholder="Select code"
                  data={triggerCodeOptions}
                  value={row.code}
                  onChange={(value) => {
                    const name = value ?? null;
                    updateTriggerRow(index, "code", name);

                    const list = triggerMasterData as Array<{
                      name?: string;
                      code?: string;
                      note?: string;
                    }>;

                    if (name) {
                      const match = list.find(
                        (item) =>
                          item.name != null && String(item.name) === name,
                      );
                      if (match && match.note != null) {
                        updateTriggerRow(
                          index,
                          "description",
                          String(match.note),
                        );
                      } else {
                        updateTriggerRow(index, "description", "");
                      }
                    } else {
                      // Code cleared via clearable button ? also clear description
                      updateTriggerRow(index, "description", "");
                    }
                  }}
                  searchable
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={5}>
                <FormTextInput
                  placeholder="Enter description"
                  value={row.description}
                  onChange={(e) =>
                    updateTriggerRow(index, "description", e.target.value)
                  }
                />
              </Grid.Col>
              <Grid.Col
                span={1}
                style={{ display: "flex", gap: 4, marginBottom: 4 }}
              >
                {form.values.trigger_modal_rows.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="lg"
                    onClick={() => removeTriggerRow(index)}
                    title="Remove row"
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                )}
                {index === form.values.trigger_modal_rows.length - 1 && (
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="lg"
                    onClick={addTriggerRow}
                    title="Add row"
                  >
                    <IconPlus size={18} />
                  </ActionIcon>
                )}
              </Grid.Col>
            </Grid>
          ))}
          {form.values.trigger_modal_rows.length === 0 && (
            <Button
              variant="light"
              color="#105476"
              leftSection={<IconPlus size={16} />}
              onClick={addTriggerRow}
              fullWidth
            >
              Add Trigger
            </Button>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setTriggerModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitTriggerModal}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      <Box
        style={{
          flex: 1,
          overflowY: "auto",
          borderRadius: "8px",
          backgroundColor: "#FFFFFF",
        }}
      >
        <Box style={{ padding: "24px 24px 32px" }}>
          {/* Action menu - available on all steps */}
          <Group justify="space-between" mb="md">
            <Text size="md" fw={600} c="#105476">
              {active === 0
                ? "Import Booking"
                : active === 1
                  ? "Party Details"
                  : active === 2
                    ? "Cargo Details"
                    : active === 3
                      ? "Pickup & Delivery Details"
                      : "Charges & Summary"}
            </Text>
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
                      "&:hover": { backgroundColor: "#F8F9FA" },
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
                  leftSection={<IconCalendarEvent size={16} />}
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": { backgroundColor: "#F8F9FA" },
                    },
                  }}
                  onClick={() => {
                    const existing = form.values.events;
                    if (existing.length > 0) {
                      form.setFieldValue("event_modal_rows", [
                        ...existing.map((e) => ({
                          eventType: e.type,
                          eventDate: e.date ? new Date(e.date) : null,
                        })),
                        { eventType: null, eventDate: null },
                      ]);
                    } else {
                      form.setFieldValue("event_modal_rows", [
                        { eventType: null, eventDate: null },
                      ]);
                    }
                    setEventsModalOpen(true);
                  }}
                >
                  Events
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileDescription size={16} />}
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": { backgroundColor: "#F8F9FA" },
                    },
                  }}
                  onClick={() => bookingDocuments.openDocumentsModal()}
                >
                  Documents
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconBellRinging size={16} />}
                  styles={{
                    item: {
                      fontFamily: "Inter",
                      fontSize: "13px",
                      fontWeight: 500,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      marginBottom: "4px",
                      "&:hover": { backgroundColor: "#F8F9FA" },
                    },
                  }}
                  onClick={() => {
                    const existing = form.values.trigger_updates;
                    if (existing.length > 0) {
                      form.setFieldValue(
                        "trigger_modal_rows",
                        existing.map((t) => ({
                          id: t.id != null ? Number(t.id) : undefined,
                          type: t.type || null,
                          code: t.code || null,
                          description: t.description || "",
                        })),
                      );
                    } else {
                      form.setFieldValue("trigger_modal_rows", [
                        {
                          id: undefined,
                          type: null,
                          code: null,
                          description: "",
                        },
                      ]);
                    }
                    setTriggerModalOpen(true);
                  }}
                >
                  Trigger Update
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
          {/* Step 1: Export Booking */}
          {active === 0 && (
            <Box>
              {/* Export Shipment Section */}
              <Grid mb="lg" gutter="sm">
                <Grid.Col span={4}>
                  <SearchableSelect
                    label="Customer Name"
                    required
                    apiEndpoint={URL.allCustomers}
                    placeholder="Type customer name"
                    searchFields={["customer_code", "customer_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.customer_code}
                    displayValue={form.values.customer_name}
                    returnOriginalData
                    onChange={(value, selectedData, originalData) => {
                      const newCode = value || "";
                      form.setFieldValue("customer_code", newCode);
                      form.setFieldValue(
                        "customer_name",
                        selectedData?.label || "",
                      );
                      if (!newCode) {
                        setAssignedToDisplayFromCustomer(null);
                        if (form.values.routed === "Self") {
                          form.setFieldValue(
                            "routed_by",
                            user?.full_name?.trim() || "",
                          );
                        }
                        return;
                      }
                      const assignedToDisplay =
                        originalData?.assigned_to_display != null
                          ? String(originalData.assigned_to_display).trim()
                          : "";
                      if (assignedToDisplay) {
                        setAssignedToDisplayFromCustomer(assignedToDisplay);
                        if (form.values.routed === "Self") {
                          form.setFieldValue("routed_by", assignedToDisplay);
                        }
                      } else {
                        setAssignedToDisplayFromCustomer(null);
                        if (form.values.routed === "Self") {
                          form.setFieldValue(
                            "routed_by",
                            user?.full_name?.trim() || "",
                          );
                        }
                      }
                    }}
                    error={form.errors.customer_code as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Dropdown
                    label="Service"
                    placeholder="Select service"
                    searchable
                    withAsterisk
                    data={inlandServiceOptions}
                    value={form.values.service_code || null}
                    onChange={(value) => {
                      const code = value ?? "";
                      const selected = inlandImportServices.find(
                        (item) => item.service_code === code,
                      );
                      form.setFieldValue("service_code", code);
                      form.setFieldValue(
                        "service_name",
                        selected?.service_name || code,
                      );
                    }}
                    error={form.errors.service_code as string}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  {/* <SingleDateInput
                      label="Date"
                      withAsterisk
                      placeholder="YYYY-MM-DD"
                      value={form.values.date || new Date()}
                      onChange={(date) => {
                        form.setFieldValue("date", date || new Date());
                      }}
                      error={form.errors.date}
                      valueFormat="YYYY-MM-DD"
                      leftSection={<IconCalendar size={18} />}
                      leftSectionPointerEvents="none"
                      radius="md"
                      size="sm"
                    /> */}
                  <SingleDateInput
                    label="Date"
                    placeholder="YYYY-MM-DD"
                    withAsterisk
                    value={form.values.date}
                    onChange={(date) => {
                      form.setFieldValue("date", date || new Date());
                    }}
                    error={form.errors.date}
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
                    value={form.values.origin_code}
                    displayValue={form.values.origin_name}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("origin_code", value || "");
                      form.setFieldValue(
                        "origin_name",
                        selectedData?.label || "",
                      );
                    }}
                    error={form.errors.origin_code as string}
                    minSearchLength={3}
                    additionalParams={{
                      transport_mode: "AIR",
                    }}
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
                    value={form.values.destination_code}
                    displayValue={form.values.destination_name}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("destination_code", value || "");
                      form.setFieldValue(
                        "destination_name",
                        selectedData?.label || "",
                      );
                    }}
                    error={form.errors.destination_code as string}
                    minSearchLength={3}
                    additionalParams={{
                      transport_mode: "AIR",
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Dropdown
                    label="Shipment Terms"
                    placeholder="Select shipment terms"
                    withAsterisk
                    searchable
                    data={shipmentOptions}
                    value={form.values.shipment_terms_code}
                    onChange={(value) => {
                      applyShipmentTermsSelection(
                        form.setFieldValue,
                        termsOfShipment,
                        value,
                      );
                    }}
                    error={form.errors.shipment_terms_code as string}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Dropdown
                    label="Freight"
                    searchable
                    placeholder="Select freight"
                    withAsterisk
                    data={["Prepaid", "Collect"]}
                    {...form.getInputProps("freight")}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Dropdown
                    label="Routed"
                    placeholder="Select routed"
                    withAsterisk
                    searchable
                    data={["Self", "Agent"]}
                    {...form.getInputProps("routed")}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  {form.values.routed === "Self" ? (
                    salespersonsData.length > 0 ? (
                      <Dropdown
                        label="Routed By"
                        placeholder="Select salesperson"
                        searchable
                        withAsterisk
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
                        placeholder="Enter routed by"
                        withAsterisk
                        {...form.getInputProps("routed_by")}
                        error={form.errors.routed_by}
                      />
                    )
                  ) : form.values.routed === "Agent" ? (
                    <SearchableSelect
                      label="Routed By"
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
                      required
                    />
                  ) : (
                    <FormTextInput
                      label="Routed By"
                      placeholder="Enter routed by"
                      withAsterisk
                      {...form.getInputProps("routed_by")}
                      error={form.errors.routed_by}
                    />
                  )}
                </Grid.Col>
                <Grid.Col span={4}>
                  <FormTextInput
                    label="Customer Service Name"
                    placeholder="Enter customer service name"
                    withAsterisk
                    value={form.values.customer_service_name}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      form.setFieldValue(
                        "customer_service_name",
                        formattedValue,
                      );
                    }}
                    error={form.errors.customer_service_name}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <FormTextInput
                    label="Bill No"
                    placeholder="Enter Bill No"
                    // format="normal"
                    value={form.values.bill_no}
                    onChange={(e) =>
                      form.setFieldValue("bill_no", e.target.value)
                    }
                    error={form.errors.bill_no}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <SingleDateInput
                    label="Bill Date"
                    placeholder="Pick bill date"
                    size="sm"
                    value={form.values.bill_date}
                    onChange={(value) => form.setFieldValue("bill_date", value)}
                    error={form.errors.bill_date as string | undefined}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <FormTextInput
                    label="IATA"
                    placeholder="e.g. IATA-1234"
                    // format="normal"
                    value={form.values.iata}
                    onChange={(e) => form.setFieldValue("iata", e.target.value)}
                    error={form.errors.iata}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <SingleDateInput
                    label="ETD (Estimated Time of Departure)"
                    placeholder="YYYY-MM-DD"
                    withAsterisk
                    value={form.values.etd ?? undefined}
                    onChange={(date) => {
                      form.setFieldValue("etd", date ?? null);
                    }}
                    error={form.errors.etd}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <SingleDateInput
                    label="ETA (Estimated Time of Arrival)"
                    placeholder="YYYY-MM-DD"
                    withAsterisk
                    value={form.values.eta ?? undefined}
                    onChange={(date) => {
                      form.setFieldValue("eta", date ?? null);
                    }}
                    error={form.errors.eta}
                  />
                </Grid.Col>
                {(form.values.service === "AIR" ||
                  form.values.service === "INLAND" ||
                  form.values.service === "FCL") && (
                  <Grid.Col span={4}>
                    <Radio.Group
                      label="Direct"
                      value={form.values.is_direct ? "true" : "false"}
                      onChange={(value) =>
                        form.setFieldValue("is_direct", value === "true")
                      }
                      styles={{
                        root: {
                          fontFamily: "Inter",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                        },
                      }}
                    >
                      <Group mt="xs">
                        <Radio value="true" label="Yes" />
                        <Radio value="false" label="No" />
                      </Group>
                    </Radio.Group>
                  </Grid.Col>
                )}
                {form.values.service === "LCL" && (
                  <Grid.Col span={4}>
                    <Radio.Group
                      label="Coload"
                      value={form.values.is_coload ? "true" : "false"}
                      onChange={(value) =>
                        form.setFieldValue("is_coload", value === "true")
                      }
                      styles={{
                        root: {
                          fontFamily: "Inter",
                        },
                        label: {
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#424242",
                          marginBottom: "4px",
                        },
                      }}
                    >
                      <Group mt="xs">
                        <Radio value="true" label="Yes" />
                        <Radio value="false" label="No" />
                      </Group>
                    </Radio.Group>
                  </Grid.Col>
                )}
              </Grid>

              <Divider my="lg" />

              {/* Ocean Schedule Section */}

              {/* Routing Details Section */}
              <Text size="md" fw={600} mb="md" c="#105476">
                Routings Details
              </Text>
              {/* Header Row */}
              <Grid
                mb="sm"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={1.25}>
                  <RequiredLabel label="Move Type" required={false} />
                </Grid.Col>
                <Grid.Col span={1.25}>
                  <RequiredLabel label="From" required={false} />
                </Grid.Col>
                <Grid.Col span={1.25}>
                  <RequiredLabel label="To" required={false} />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <RequiredLabel label="ETD" required={false} />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <RequiredLabel label="ETA" required={false} />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <RequiredLabel label="Carrier" required={false} />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <RequiredLabel
                    label={
                      form.values.routingDetails[0]?.move_type === "AIR"
                        ? "Flight Number"
                        : form.values.routingDetails[0]?.move_type === "SEA"
                          ? "Voyage Number"
                          : form.values.routingDetails[0]?.move_type === "ROAD"
                            ? "Truck Number"
                            : form.values.routingDetails[0]?.move_type ===
                                "RAIL"
                              ? "Rail Number"
                              : "Transport Number"
                    }
                    required={false}
                  />
                </Grid.Col>
                <Grid.Col span={1.25}>
                  <RequiredLabel label="Status" required={false} />
                </Grid.Col>
                <Grid.Col span={1}>
                  <RequiredLabel label="Actions" required={false} />
                </Grid.Col>
              </Grid>
              {/* Dynamic Form Rows */}
              <Stack gap="sm">
                {form.values.routingDetails.map((_, index) => (
                  <Box key={index}>
                    <Grid gutter="sm">
                      <Grid.Col span={1.25}>
                        <Dropdown
                          data={["SEA", "AIR", "ROAD", "RAIL"]}
                          placeholder="Select move type"
                          // withAsterisk
                          searchable
                          value={
                            form.values.routingDetails[index]?.move_type || ""
                          }
                          onChange={(value) => {
                            const previousMoveType =
                              form.values.routingDetails[index]?.move_type;
                            form.setFieldValue(
                              `routingDetails.${index}.move_type`,
                              value || "",
                            );
                            // Clear From, To, and Carrier values when move_type changes
                            if (value && value !== previousMoveType) {
                              form.setFieldValue(
                                `routingDetails.${index}.from_location_code`,
                                "",
                              );
                              form.setFieldValue(
                                `routingDetails.${index}.to_location_code`,
                                "",
                              );
                              form.setFieldValue(
                                `routingDetails.${index}.carrier_code`,
                                "",
                              );
                            }
                          }}
                          error={
                            form.errors[
                              `routingDetails.${index}.move_type`
                            ] as string
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={1.25}>
                        <SearchableSelect
                          placeholder="Type from location code or name"
                          // required
                          apiEndpoint={URL.portMaster}
                          searchFields={["port_code", "port_name"]}
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.port_code),
                            label: `${item.port_name} (${item.port_code})`,
                          })}
                          value={
                            form.values.routingDetails[index]
                              ?.from_location_code || ""
                          }
                          displayValue={
                            form.values.routingDetails[index]
                              ?.from_location_name &&
                            form.values.routingDetails[index]
                              ?.from_location_code
                              ? `${form.values.routingDetails[index].from_location_name} (${form.values.routingDetails[index].from_location_code})`
                              : undefined
                          }
                          onChange={(value, selectedData) => {
                            form.setFieldValue(
                              `routingDetails.${index}.from_location_code`,
                              value || "",
                            );
                            form.setFieldValue(
                              `routingDetails.${index}.from_location_name`,
                              selectedData?.label || "",
                            );
                          }}
                          minSearchLength={3}
                          additionalParams={
                            getTransportMode(
                              form.values.routingDetails[index]?.move_type,
                            )
                              ? {
                                  transport_mode: getTransportMode(
                                    form.values.routingDetails[index]
                                      ?.move_type,
                                  )!,
                                }
                              : undefined
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={1.25}>
                        <SearchableSelect
                          placeholder="Type to location code or name"
                          // required
                          apiEndpoint={URL.portMaster}
                          searchFields={["port_code", "port_name"]}
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.port_code),
                            label: `${item.port_name} (${item.port_code})`,
                          })}
                          value={
                            form.values.routingDetails[index]
                              ?.to_location_code || ""
                          }
                          displayValue={
                            form.values.routingDetails[index]
                              ?.to_location_name &&
                            form.values.routingDetails[index]?.to_location_code
                              ? `${form.values.routingDetails[index].to_location_name} (${form.values.routingDetails[index].to_location_code})`
                              : undefined
                          }
                          onChange={(value, selectedData) => {
                            form.setFieldValue(
                              `routingDetails.${index}.to_location_code`,
                              value || "",
                            );
                            form.setFieldValue(
                              `routingDetails.${index}.to_location_name`,
                              selectedData?.label || "",
                            );
                          }}
                          minSearchLength={3}
                          additionalParams={
                            getTransportMode(
                              form.values.routingDetails[index]?.move_type,
                            )
                              ? {
                                  transport_mode: getTransportMode(
                                    form.values.routingDetails[index]
                                      ?.move_type,
                                  )!,
                                }
                              : undefined
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <SingleDateInput
                          placeholder="YYYY-MM-DD"
                          value={
                            form.values.routingDetails[index]?.etd ?? undefined
                          }
                          onChange={(date) => {
                            form.setFieldValue(
                              `routingDetails.${index}.etd`,
                              date ?? null,
                            );
                          }}
                          error={
                            form.errors[`routingDetails.${index}.etd`] as string
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <SingleDateInput
                          placeholder="YYYY-MM-DD"
                          value={
                            form.values.routingDetails[index]?.eta ?? undefined
                          }
                          onChange={(date) => {
                            form.setFieldValue(
                              `routingDetails.${index}.eta`,
                              date ?? null,
                            );
                          }}
                          error={
                            form.errors[`routingDetails.${index}.eta`] as string
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <SearchableSelect
                          placeholder="Type carrier name"
                          apiEndpoint={URL.carrier}
                          searchFields={["carrier_code", "carrier_name"]}
                          displayFormat={carrierDisplayFormat}
                          value={
                            form.values.routingDetails[index]?.carrier_code ||
                            ""
                          }
                          displayValue={formatCarrierDisplayValue(
                            form.values.routingDetails[index]?.carrier_name,
                            form.values.routingDetails[index]?.carrier_code,
                          )}
                          onChange={(value, selectedData) => {
                            form.setFieldValue(
                              `routingDetails.${index}.carrier_code`,
                              value || "",
                            );
                            form.setFieldValue(
                              `routingDetails.${index}.carrier_name`,
                              parseCarrierNameFromLabel(
                                selectedData?.label || "",
                              ),
                            );
                          }}
                          error={
                            form.errors[
                              `routingDetails.${index}.carrier_code`
                            ] as string
                          }
                          minSearchLength={2}
                          additionalParams={
                            getTransportMode(
                              form.values.routingDetails[index]?.move_type,
                            )
                              ? {
                                  transport_mode: getTransportMode(
                                    form.values.routingDetails[index]
                                      ?.move_type,
                                  )!,
                                }
                              : undefined
                          }
                          // required
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <FormTextInput
                          format="normal"
                          placeholder={
                            form.values.routingDetails[index]?.move_type ===
                            "AIR"
                              ? "Enter flight number"
                              : form.values.routingDetails[index]?.move_type ===
                                  "SEA"
                                ? "Enter voyage number"
                                : form.values.routingDetails[index]
                                      ?.move_type === "ROAD"
                                  ? "Enter truck number"
                                  : form.values.routingDetails[index]
                                        ?.move_type === "RAIL"
                                    ? "Enter rail number"
                                    : "Enter transport number"
                          }
                          // withAsterisk
                          {...form.getInputProps(
                            `routingDetails.${index}.flight_no`,
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.25}>
                        <Dropdown
                          data={["Active", "Inactive", "Pending", "Completed"]}
                          placeholder="Select status"
                          // withAsterisk
                          searchable
                          {...form.getInputProps(
                            `routingDetails.${index}.status`,
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Group gap="xs">
                          {form.values.routingDetails.length - 1 === index && (
                            <Button
                              variant="light"
                              color="#105476"
                              size="sm"
                              px={12}
                              onClick={addRoutingDetail}
                            >
                              <IconPlus size={14} />
                            </Button>
                          )}
                          {form.values.routingDetails.length > 1 && (
                            <Button
                              variant="light"
                              color="red"
                              size="sm"
                              px={12}
                              onClick={() => removeRoutingDetail(index)}
                            >
                              <IconTrash size={14} />
                            </Button>
                          )}
                        </Group>
                      </Grid.Col>
                    </Grid>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Step 2: Party Details */}
          {active === 1 && (
            <Box>
              {/* Shipper Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Shipper Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Shipper Name"
                    placeholder="Type shipper name"
                    apiEndpoint={URL.shipper}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.shipper_code}
                    displayValue={shipperDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      const newValue = value || "";
                      const hasForwarder =
                        Boolean(
                          String(form.values.forwarder_code || "").trim(),
                        ) ||
                        Boolean(forwarderDisplayName?.trim()) ||
                        Boolean(
                          String(
                            (form.values as { forwarder_name?: string })
                              .forwarder_name || "",
                          ).trim(),
                        );
                      form.setFieldValue("shipper_code", newValue);

                      if (!newValue) {
                        // Clear everything immediately when value is cleared
                        setShipperDisplayName(null);
                        setShipperAddressOptions([]);
                        form.setFieldValue("shipper_name", "");
                        form.setFieldValue("shipper_address_id", 0);
                        form.setFieldValue("shipper_address", "");
                        form.setFieldValue("shipper_email", "");
                        return; // Early return to avoid running the rest
                      }

                      const shipperName =
                        selectedData?.label ||
                        (hasForwarder
                          ? toTitleCase(
                              shipperTypedNameRef.current || value || "",
                            )
                          : "");
                      setShipperDisplayName(shipperName || null);
                      form.setFieldValue("shipper_name", shipperName);

                      if (
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

                        const addressOptions = addressesData.map((addr) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));
                        setShipperAddressOptions(addressOptions);

                        const primary = addressesData.find(
                          (a) =>
                            String(a.address_type || "").toUpperCase() ===
                            "PRIMARY",
                        );

                        if (primary) {
                          form.setFieldValue("shipper_address_id", primary.id);
                          form.setFieldValue(
                            "shipper_address",
                            primary.address ?? "",
                          );
                          form.setFieldValue(
                            "shipper_email",
                            primary.email ?? "",
                          );
                        } else {
                          form.setFieldValue("shipper_address_id", 0);
                          form.setFieldValue("shipper_address", "");
                          form.setFieldValue("shipper_email", "");
                        }
                      }
                    }}
                    onSearchTextChange={(text) => {
                      if (
                        Boolean(
                          String(form.values.forwarder_code || "").trim(),
                        ) ||
                        Boolean(forwarderDisplayName?.trim()) ||
                        Boolean(
                          String(
                            (form.values as { forwarder_name?: string })
                              .forwarder_name || "",
                          ).trim(),
                        )
                      ) {
                        shipperTypedNameRef.current = text;
                      }
                    }}
                    onSearchComplete={({ searchTerm, hasResults }) => {
                      const hasForwarder =
                        Boolean(
                          String(form.values.forwarder_code || "").trim(),
                        ) ||
                        Boolean(forwarderDisplayName?.trim()) ||
                        Boolean(
                          String(
                            (form.values as { forwarder_name?: string })
                              .forwarder_name || "",
                          ).trim(),
                        );
                      if (
                        hasForwarder &&
                        !hasResults &&
                        searchTerm.length >= 2
                      ) {
                        form.setFieldValue("shipper_code", "");
                        form.setFieldValue(
                          "shipper_name",
                          toTitleCase(searchTerm),
                        );
                        setShipperDisplayName(toTitleCase(searchTerm));
                        setShipperAddressOptions([]);
                        form.setFieldValue("shipper_address", "");
                        form.setFieldValue("shipper_address_id", 0);
                        form.setFieldValue("shipper_email", "");
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.shipper_code as string}
                    minSearchLength={2}
                    // required
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Shipper E-mail ID"
                    placeholder="Enter email address"
                    format="normal"
                    {...form.getInputProps("shipper_email")}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  {(() => {
                    const hasForwarder =
                      Boolean(
                        String(form.values.forwarder_code || "").trim(),
                      ) ||
                      Boolean(forwarderDisplayName?.trim()) ||
                      Boolean(
                        String(
                          (form.values as { forwarder_name?: string })
                            .forwarder_name || "",
                        ).trim(),
                      );
                    const shipperAddressEditable =
                      (hasForwarder &&
                        !String(form.values.shipper_code || "").trim()) ||
                      shipperAddressOptions.length === 0;
                    if (shipperAddressEditable) {
                      return (
                        <FormTextInput
                          label="Shipper Address"
                          placeholder="Enter shipper address"
                          value={form.values.shipper_address || ""}
                          onChange={(e) => {
                            form.setFieldValue(
                              "shipper_address",
                              toTitleCase(e.currentTarget.value),
                            );
                            form.setFieldValue("shipper_address_id", 0);
                          }}
                        />
                      );
                    }
                    return (
                      <Dropdown
                        label="Shipper Address"
                        placeholder="Select shipper address"
                        searchable
                        clearable
                        data={shipperAddressOptions}
                        value={
                          form.values.shipper_address_id !== 0
                            ? String(form.values.shipper_address_id)
                            : ""
                        }
                        key={`shipper-${form.values.shipper_address_id}`}
                        onChange={(value) => {
                          form.setFieldValue(
                            "shipper_address_id",
                            value ? parseInt(value) || 0 : 0,
                          );
                          const opt = shipperAddressOptions.find(
                            (o) => o.value === value,
                          );
                          form.setFieldValue(
                            "shipper_address",
                            opt?.label ?? "",
                          );
                        }}
                        error={form.errors.shipper_address_id}
                      />
                    );
                  })()}
                </Grid.Col>
              </Grid>

              <Divider my="md" />

              {/* Consignee Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Consignee Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={6}>
                  {consigneeHasResults === false &&
                  consigneeSearch.trim().length >= 2 ? (
                    <FormTextInput
                      ref={consigneeTextRef}
                      label="Consignee Name"
                      placeholder="Enter consignee name"
                      value={form.values.consignee_name || consigneeSearch}
                      onChange={(e) => {
                        const v = toTitleCase(e.currentTarget.value);
                        setConsigneeSearch(v);
                        form.setFieldValue("consignee_name", v);
                        form.setFieldValue("consignee_code", "");
                        if (!v.trim()) {
                          form.setFieldValue("consignee_address", "");
                          form.setFieldValue("consignee_address_id", 0);
                          form.setFieldValue("consignee_email", "");
                          setConsigneeAddressOptions([]);
                          setConsigneeAddressCustom(false);
                          setConsigneeAddressSearch("");
                        }
                      }}
                    />
                  ) : (
                    <Select
                      ref={consigneeSelectRef}
                      label="Consignee Name"
                      placeholder="Select or search consignee"
                      searchable
                      clearable
                      data={consigneeOptions}
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
                      searchValue={consigneeSearch}
                      onSearchChange={(value) => {
                        const v = toTitleCase(value);
                        setConsigneeSearch(v);
                        setConsigneeHasResults(null);
                        debouncedConsigneeSearch(v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab" && consigneeIsSearching) {
                          e.preventDefault();
                        }
                      }}
                      value={form.values.consignee_code || ""}
                      onChange={(value) => {
                        if (!value) {
                          form.setFieldValue("consignee_code", "");
                          form.setFieldValue("consignee_name", "");
                          form.setFieldValue("consignee_address", "");
                          form.setFieldValue("consignee_address_id", 0);
                          form.setFieldValue("consignee_email", "");
                          setConsigneeAddressOptions([]);
                          setConsigneeAddressCustom(false);
                          setConsigneeAddressSearch("");
                          setConsigneeSearch("");
                          return;
                        }
                        const original = consigneeDataRef.current[value] || {};
                        const name = String(
                          (original as Record<string, unknown>).customer_name ||
                            "",
                        );
                        const addressOptions = mapShipmentPartyAddressOptions(
                          original as Record<string, unknown>,
                          toTitleCase,
                        );
                        const primaryAddr = addressOptions[0];
                        setConsigneeAddressOptions(addressOptions);
                        setConsigneeAddressCustom(false);
                        form.setFieldValue("consignee_code", value);
                        form.setFieldValue("consignee_name", toTitleCase(name));
                        form.setFieldValue(
                          "consignee_address",
                          primaryAddr?.value || "",
                        );
                        form.setFieldValue("consignee_address_id", 0);
                        form.setFieldValue(
                          "consignee_email",
                          primaryAddr?.email || "",
                        );
                        setConsigneeAddressSearch(primaryAddr?.value || "");
                        setConsigneeSearch(name);
                      }}
                      nothingFoundMessage="No consignee found - type to enter new consignee"
                    />
                  )}
                </Grid.Col>
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Consignee Email Id"
                    placeholder="Enter email address"
                    format="normal"
                    {...form.getInputProps("consignee_email")}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  {shouldUseCustomShipmentPartyAddress(
                    consigneeAddressCustom,
                    form.values.consignee_address || "",
                    consigneeAddressOptions,
                  ) ? (
                    <FormTextInput
                      label="Consignee Address"
                      placeholder="Enter consignee address"
                      value={form.values.consignee_address}
                      onChange={(e) => {
                        const v = toTitleCase(e.currentTarget.value);
                        form.setFieldValue("consignee_address", v);
                        if (!v.trim()) {
                          setConsigneeAddressCustom(false);
                          setConsigneeAddressSearch("");
                        }
                      }}
                    />
                  ) : (
                    <Dropdown
                      label="Consignee Address"
                      placeholder="Select consignee address"
                      searchable
                      clearable
                      data={consigneeAddressOptions}
                      value={form.values.consignee_address || ""}
                      searchValue={consigneeAddressSearch}
                      onSearchChange={(value) => {
                        setConsigneeAddressSearch(value);
                        if (
                          value.trim() &&
                          !shipmentPartyAddressMatchesSearch(
                            consigneeAddressOptions,
                            value,
                          )
                        ) {
                          setConsigneeAddressCustom(true);
                          form.setFieldValue(
                            "consignee_address",
                            toTitleCase(value),
                          );
                          form.setFieldValue("consignee_email", "");
                        }
                      }}
                      onChange={(value) => {
                        const selected = consigneeAddressOptions.find(
                          (item) => item.value === value,
                        );
                        form.setFieldValue(
                          "consignee_address",
                          value ? toTitleCase(value) : "",
                        );
                        form.setFieldValue(
                          "consignee_email",
                          selected?.email || "",
                        );
                        setConsigneeAddressSearch(value || "");
                        setConsigneeAddressCustom(false);
                      }}
                    />
                  )}
                </Grid.Col>
              </Grid>
              <Divider my="md" />

              {/* Forwarder Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Forwarder Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Forwarder Name"
                    placeholder="Type forwarder name"
                    apiEndpoint={URL.forwarder}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.forwarder_code}
                    displayValue={forwarderDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      const newValue = value || "";
                      form.setFieldValue("forwarder_code", newValue);

                      if (!newValue) {
                        setForwarderDisplayName(null);
                        setForwarderAddressOptions([]);
                        form.setFieldValue("forwarder_address_id", 0);
                        form.setFieldValue("forwarder_address", "");
                        form.setFieldValue("forwarder_email", "");
                        return;
                      }

                      if (selectedData) {
                        setForwarderDisplayName(selectedData.label);
                      }

                      if (
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
                        const addressOptions = addressesData.map((addr) => ({
                          value: String(addr.id),
                          label: addr.address,
                          email: addr.email ?? "",
                        }));
                        setForwarderAddressOptions(addressOptions);

                        const primary = addressesData?.find(
                          (a) =>
                            String(a.address_type || "").toUpperCase() ===
                            "PRIMARY",
                        );
                        if (primary) {
                          form.setFieldValue(
                            "forwarder_address_id",
                            primary.id,
                          );
                          form.setFieldValue(
                            "forwarder_address",
                            primary.address ?? "",
                          );
                          form.setFieldValue(
                            "forwarder_email",
                            primary.email ?? "",
                          );
                        } else {
                          form.setFieldValue("forwarder_address_id", 0);
                          form.setFieldValue("forwarder_address", "");
                          form.setFieldValue("forwarder_email", "");
                        }
                      }

                      requestAnimationFrame(() => {
                        forwarderEmailRef.current?.focus({
                          preventScroll: true,
                        });
                      });
                    }}
                    returnOriginalData={true}
                    error={form.errors.forwarder_code as string}
                    minSearchLength={2}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <FormTextInput
                    ref={forwarderEmailRef}
                    label="Forwarder Email Id"
                    placeholder="Enter email address"
                    format="normal"
                    {...form.getInputProps("forwarder_email")}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Dropdown
                    label="Forwarder Address"
                    placeholder="Select forwarder address"
                    searchable
                    clearable
                    data={forwarderAddressOptions}
                    key={
                      form.values.forwarder_address_id &&
                      form.values.forwarder_address_id !== 0
                        ? String(form.values.forwarder_address_id)
                        : "forwarder-empty"
                    }
                    value={
                      form.values.forwarder_address_id &&
                      form.values.forwarder_address_id !== 0
                        ? String(form.values.forwarder_address_id)
                        : ""
                    }
                    onChange={(value) => {
                      form.setFieldValue(
                        "forwarder_address_id",
                        value ? parseInt(value) : 0,
                      );
                      const selected = forwarderAddressOptions.find(
                        (o) => o.value === value,
                      );
                      form.setFieldValue(
                        "forwarder_address",
                        selected?.label ?? "",
                      );
                      if (selected?.email) {
                        form.setFieldValue("forwarder_email", selected.email);
                      }
                    }}
                    error={form.errors.forwarder_address_id}
                    disabled={forwarderAddressOptions.length === 0}
                  />
                </Grid.Col>
              </Grid>
              <Divider my="md" />

              {/* Destination Agent Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Destination Agent Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Destination Agent Name"
                    placeholder="Type destination agent name"
                    apiEndpoint={URL.agent}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.destination_agent_code}
                    displayValue={destinationAgentDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      const newValue = value || "";
                      form.setFieldValue("destination_agent_code", newValue);

                      if (!newValue) {
                        setDestinationAgentDisplayName(null);
                        setAgentAddressOptions([]);
                        form.setFieldValue("destination_agent_address_id", 0);
                        form.setFieldValue("destination_agent_email", "");
                        return;
                      }

                      if (selectedData) {
                        setDestinationAgentDisplayName(selectedData.label);
                      }

                      if (
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
                        const addressOptions = addressesData.map((addr) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));
                        setAgentAddressOptions(addressOptions);

                        const primary = addressesData?.find(
                          (a) =>
                            String(a.address_type || "").toUpperCase() ===
                            "PRIMARY",
                        );
                        if (primary) {
                          form.setFieldValue(
                            "destination_agent_address_id",
                            primary.id,
                          );
                          form.setFieldValue(
                            "destination_agent_email",
                            primary.email ?? "",
                          );
                        } else {
                          form.setFieldValue("destination_agent_address_id", 0);
                          form.setFieldValue("destination_agent_email", "");
                        }
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.destination_agent_code as string}
                    minSearchLength={2}
                    // required
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Destination Agent Email Id"
                    placeholder="Enter email address"
                    format="normal"
                    {...form.getInputProps("destination_agent_email")}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Dropdown
                    label="Destination Agent Address"
                    placeholder="Select agent address"
                    searchable
                    clearable
                    data={agentAddressOptions}
                    key={
                      form.values.destination_agent_address_id &&
                      form.values.destination_agent_address_id !== 0
                        ? String(form.values.destination_agent_address_id)
                        : "agent-empty"
                    }
                    value={
                      form.values.destination_agent_address_id &&
                      form.values.destination_agent_address_id !== 0
                        ? String(form.values.destination_agent_address_id)
                        : ""
                    }
                    onChange={(value) => {
                      form.setFieldValue(
                        "destination_agent_address_id",
                        value ? parseInt(value) : 0,
                      );
                    }}
                    error={form.errors.destination_agent_address_id}
                    disabled={agentAddressOptions.length === 0}
                  />
                </Grid.Col>
              </Grid>
              <Divider my="md" />

              {/* Billing Customer Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Billing Customer Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={4}>
                  <SearchableSelect
                    label="Billing Customer Name"
                    placeholder="Type billing customer name"
                    apiEndpoint={URL.allCustomers}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.billing_customer_code}
                    displayValue={billingCustomerDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      const newValue = value || "";
                      form.setFieldValue("billing_customer_code", newValue);

                      if (!newValue) {
                        setBillingCustomerDisplayName(null);
                        setBillingCustomerAddressOptions([]);
                        form.setFieldValue("billing_customer_address_id", 0);
                        return;
                      }

                      if (selectedData) {
                        setBillingCustomerDisplayName(selectedData.label);
                      }

                      if (
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
                        const addressOptions = addressesData.map((addr) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));
                        setBillingCustomerAddressOptions(addressOptions);

                        const primary = addressesData?.find(
                          (a) =>
                            String(a.address_type || "").toUpperCase() ===
                            "PRIMARY",
                        );
                        if (primary) {
                          form.setFieldValue(
                            "billing_customer_address_id",
                            primary.id,
                          );
                        } else {
                          form.setFieldValue("billing_customer_address_id", 0);
                        }
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.billing_customer_code as string}
                    minSearchLength={2}
                    // required
                  />
                </Grid.Col>
                <Grid.Col span={8}>
                  <Dropdown
                    label="Billing Customer Address"
                    placeholder="Select billing address"
                    searchable
                    clearable
                    data={billingCustomerAddressOptions}
                    key={
                      form.values.billing_customer_address_id &&
                      form.values.billing_customer_address_id !== 0
                        ? String(form.values.billing_customer_address_id)
                        : "billing-empty"
                    }
                    value={
                      form.values.billing_customer_address_id &&
                      form.values.billing_customer_address_id !== 0
                        ? String(form.values.billing_customer_address_id)
                        : ""
                    }
                    onChange={(value) => {
                      form.setFieldValue(
                        "billing_customer_address_id",
                        value ? parseInt(value) : 0,
                      );
                    }}
                    error={form.errors.billing_customer_address_id}
                    disabled={billingCustomerAddressOptions.length === 0}
                  />
                </Grid.Col>
              </Grid>
              <Divider my="md" />

              {/* Notify Customer 1 Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Notify Customer 1 Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={6}>
                  {notifyCustomerHasResults === false &&
                  notifyCustomerSearch.trim().length >= 2 ? (
                    <FormTextInput
                      ref={notify1TextRef}
                      label="Notify Customer 1 Name"
                      placeholder="Enter notify customer name"
                      value={
                        notifyCustomerSearch || notifyCustomerDisplayName || ""
                      }
                      onChange={(e) => {
                        const v = toTitleCase(e.currentTarget.value);
                        setNotifyCustomerSearch(v);
                        form.setFieldValue("notify1_customer_name", v);
                        setNotifyCustomerAddressOptions([]);
                        setNotifyCustomerAddressCustom(false);
                        setNotifyCustomerAddressSearch("");
                        form.setFieldValue("notify1_customer_address", "");
                        form.setFieldValue("notify1_customer_email", "");
                      }}
                    />
                  ) : (
                    <Select
                      ref={notify1SelectRef}
                      label="Notify Customer 1 Name"
                      placeholder="Select or search notify customer"
                      searchable
                      clearable
                      data={notifyCustomerOptions}
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
                      searchValue={notifyCustomerSearch}
                      onSearchChange={(value) => {
                        const v = toTitleCase(value);
                        setNotifyCustomerSearch(v);
                        setNotifyCustomerHasResults(null);
                        debouncedNotifyCustomerSearch(v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab" && notifyCustomerIsSearching) {
                          e.preventDefault();
                        }
                      }}
                      value={notifyCustomerSelectedId || ""}
                      onChange={(value) => {
                        if (!value) {
                          setNotifyCustomerSelectedId("");
                          form.setFieldValue("notify1_customer_name", "");
                          form.setFieldValue("notify1_customer_address", "");
                          form.setFieldValue("notify1_customer_email", "");
                          setNotifyCustomerAddressOptions([]);
                          setNotifyCustomerAddressCustom(false);
                          setNotifyCustomerAddressSearch("");
                          setNotifyCustomerSearch("");
                          return;
                        }
                        const original =
                          notifyCustomerDataRef.current[value] || {};
                        const name = String(
                          (original as any).customer_name || "",
                        );
                        const addressOptions = mapShipmentPartyAddressOptions(
                          original as Record<string, unknown>,
                          toTitleCase,
                        );
                        const primaryAddr = addressOptions[0];
                        setNotifyCustomerAddressOptions(addressOptions);
                        setNotifyCustomerAddressCustom(false);
                        form.setFieldValue(
                          "notify1_customer_name",
                          toTitleCase(name),
                        );
                        form.setFieldValue(
                          "notify1_customer_email",
                          primaryAddr?.email || "",
                        );
                        form.setFieldValue(
                          "notify1_customer_address",
                          primaryAddr?.value || "",
                        );
                        setNotifyCustomerAddressSearch(primaryAddr?.value || "");
                        setNotifyCustomerSearch(name);
                        setNotifyCustomerSelectedId(value);
                      }}
                      nothingFoundMessage="No notify customer found - type to enter new"
                    />
                  )}
                </Grid.Col>
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Notify Customer 1 Email Id"
                    placeholder="Enter email address"
                    format="normal"
                    {...form.getInputProps("notify1_customer_email")}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  {shouldUseCustomShipmentPartyAddress(
                    notifyCustomerAddressCustom,
                    form.values.notify1_customer_address || "",
                    notifyCustomerAddressOptions,
                  ) ? (
                    <FormTextInput
                      label="Notify Customer 1 Address"
                      placeholder="Enter notify address"
                      value={form.values.notify1_customer_address}
                      onChange={(e) => {
                        const v = toTitleCase(e.currentTarget.value);
                        form.setFieldValue("notify1_customer_address", v);
                        if (!v.trim()) {
                          setNotifyCustomerAddressCustom(false);
                          setNotifyCustomerAddressSearch("");
                        }
                      }}
                    />
                  ) : (
                    <Dropdown
                      label="Notify Customer 1 Address"
                      placeholder="Select notify address"
                      searchable
                      clearable
                      data={notifyCustomerAddressOptions}
                      value={form.values.notify1_customer_address || ""}
                      searchValue={notifyCustomerAddressSearch}
                      onSearchChange={(value) => {
                        setNotifyCustomerAddressSearch(value);
                        if (
                          value.trim() &&
                          !shipmentPartyAddressMatchesSearch(
                            notifyCustomerAddressOptions,
                            value,
                          )
                        ) {
                          setNotifyCustomerAddressCustom(true);
                          form.setFieldValue(
                            "notify1_customer_address",
                            toTitleCase(value),
                          );
                          form.setFieldValue("notify1_customer_email", "");
                        }
                      }}
                      onChange={(value) => {
                        const selected = notifyCustomerAddressOptions.find(
                          (item) => item.value === value,
                        );
                        form.setFieldValue(
                          "notify1_customer_address",
                          value ? toTitleCase(value) : "",
                        );
                        form.setFieldValue(
                          "notify1_customer_email",
                          selected?.email || "",
                        );
                        setNotifyCustomerAddressSearch(value || "");
                        setNotifyCustomerAddressCustom(false);
                      }}
                    />
                  )}
                </Grid.Col>
              </Grid>
              <Divider my="md" />

              {/* Notify Customer 2 Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Notify Customer 2 Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={6}>
                  {notify2CustomerHasResults === false &&
                  notify2CustomerSearch.trim().length >= 2 ? (
                    <FormTextInput
                      ref={notify2TextRef}
                      label="Notify Customer 2 Name"
                      placeholder="Enter notify customer name"
                      value={
                        notify2CustomerSearch ||
                        notify2CustomerDisplayName ||
                        ""
                      }
                      onChange={(e) => {
                        const v = toTitleCase(e.currentTarget.value);
                        setNotify2CustomerSearch(v);
                        form.setFieldValue("notify2_customer_name", v);
                        setNotify2CustomerAddressOptions([]);
                        setNotify2CustomerAddressCustom(false);
                        setNotify2CustomerAddressSearch("");
                        form.setFieldValue("notify2_customer_address", "");
                        form.setFieldValue("notify2_customer_email", "");
                      }}
                    />
                  ) : (
                    <Select
                      ref={notify2SelectRef}
                      label="Notify Customer 2 Name"
                      placeholder="Select or search notify customer"
                      searchable
                      clearable
                      data={notify2CustomerOptions}
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
                      searchValue={notify2CustomerSearch}
                      onSearchChange={(value) => {
                        const v = toTitleCase(value);
                        setNotify2CustomerSearch(v);
                        setNotify2CustomerHasResults(null);
                        debouncedNotify2CustomerSearch(v);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab" && notify2CustomerIsSearching) {
                          e.preventDefault();
                        }
                      }}
                      value={notify2CustomerSelectedId || ""}
                      onChange={(value) => {
                        if (!value) {
                          setNotify2CustomerSelectedId("");
                          form.setFieldValue("notify2_customer_name", "");
                          form.setFieldValue("notify2_customer_address", "");
                          form.setFieldValue("notify2_customer_email", "");
                          setNotify2CustomerAddressOptions([]);
                          setNotify2CustomerAddressCustom(false);
                          setNotify2CustomerAddressSearch("");
                          setNotify2CustomerSearch("");
                          return;
                        }
                        const original =
                          notify2CustomerDataRef.current[value] || {};
                        const name = String(
                          (original as any).customer_name || "",
                        );
                        const addressOptions = mapShipmentPartyAddressOptions(
                          original as Record<string, unknown>,
                          toTitleCase,
                        );
                        const primaryAddr = addressOptions[0];
                        setNotify2CustomerAddressOptions(addressOptions);
                        setNotify2CustomerAddressCustom(false);
                        form.setFieldValue(
                          "notify2_customer_name",
                          toTitleCase(name),
                        );
                        form.setFieldValue(
                          "notify2_customer_email",
                          primaryAddr?.email || "",
                        );
                        form.setFieldValue(
                          "notify2_customer_address",
                          primaryAddr?.value || "",
                        );
                        setNotify2CustomerAddressSearch(primaryAddr?.value || "");
                        setNotify2CustomerSearch(name);
                        setNotify2CustomerSelectedId(value);
                      }}
                      nothingFoundMessage="No notify customer found - type to enter new"
                    />
                  )}
                </Grid.Col>
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Notify Customer 2 Email Id"
                    placeholder="Enter email address"
                    format="normal"
                    {...form.getInputProps("notify2_customer_email")}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  {shouldUseCustomShipmentPartyAddress(
                    notify2CustomerAddressCustom,
                    form.values.notify2_customer_address || "",
                    notify2CustomerAddressOptions,
                  ) ? (
                    <FormTextInput
                      label="Notify Customer 2 Address"
                      placeholder="Enter notify address"
                      value={form.values.notify2_customer_address}
                      onChange={(e) => {
                        const v = toTitleCase(e.currentTarget.value);
                        form.setFieldValue("notify2_customer_address", v);
                        if (!v.trim()) {
                          setNotify2CustomerAddressCustom(false);
                          setNotify2CustomerAddressSearch("");
                        }
                      }}
                    />
                  ) : (
                    <Dropdown
                      label="Notify Customer 2 Address"
                      placeholder="Select notify address"
                      searchable
                      clearable
                      data={notify2CustomerAddressOptions}
                      value={form.values.notify2_customer_address || ""}
                      searchValue={notify2CustomerAddressSearch}
                      onSearchChange={(value) => {
                        setNotify2CustomerAddressSearch(value);
                        if (
                          value.trim() &&
                          !shipmentPartyAddressMatchesSearch(
                            notify2CustomerAddressOptions,
                            value,
                          )
                        ) {
                          setNotify2CustomerAddressCustom(true);
                          form.setFieldValue(
                            "notify2_customer_address",
                            toTitleCase(value),
                          );
                          form.setFieldValue("notify2_customer_email", "");
                        }
                      }}
                      onChange={(value) => {
                        const selected = notify2CustomerAddressOptions.find(
                          (item) => item.value === value,
                        );
                        form.setFieldValue(
                          "notify2_customer_address",
                          value ? toTitleCase(value) : "",
                        );
                        form.setFieldValue(
                          "notify2_customer_email",
                          selected?.email || "",
                        );
                        setNotify2CustomerAddressSearch(value || "");
                        setNotify2CustomerAddressCustom(false);
                      }}
                    />
                  )}
                </Grid.Col>
              </Grid>
              <Divider my="md" />

              {/* CHA Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                CHA Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={4}>
                  <SearchableSelect
                    label="CHA Name"
                    placeholder="Type CHA name"
                    apiEndpoint={URL.cha}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.cha_code}
                    displayValue={chaDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      const newValue = value || "";
                      form.setFieldValue("cha_code", newValue);

                      if (!newValue) {
                        setChaDisplayName(null);
                        setChaAddressOptions([]);
                        form.setFieldValue("cha_address_id", 0);
                        return;
                      }

                      if (selectedData) {
                        setChaDisplayName(selectedData.label);
                      }

                      if (
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
                        const addressOptions = addressesData.map((addr) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));
                        setChaAddressOptions(addressOptions);

                        const primary = addressesData?.find(
                          (a) =>
                            String(a.address_type || "").toUpperCase() ===
                            "PRIMARY",
                        );
                        if (primary) {
                          form.setFieldValue("cha_address_id", primary.id);
                        } else {
                          form.setFieldValue("cha_address_id", 0);
                        }
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.cha_code as string}
                    minSearchLength={2}
                  />
                </Grid.Col>
                <Grid.Col span={8}>
                  <Dropdown
                    label="CHA Address"
                    placeholder="Select CHA address"
                    searchable
                    clearable
                    data={chaAddressOptions}
                    key={
                      form.values.cha_address_id &&
                      form.values.cha_address_id !== 0
                        ? String(form.values.cha_address_id)
                        : "cha-empty"
                    }
                    value={
                      form.values.cha_address_id &&
                      form.values.cha_address_id !== 0
                        ? String(form.values.cha_address_id)
                        : ""
                    }
                    onChange={(value) => {
                      form.setFieldValue(
                        "cha_address_id",
                        value ? parseInt(value) : 0,
                      );
                    }}
                    error={form.errors.cha_address_id}
                    disabled={chaAddressOptions.length === 0}
                  />
                </Grid.Col>
              </Grid>
            </Box>
          )}

          {/* Step 3: Cargo Details */}
          {active === 2 && (
            <Box>
              {/* Common Fields */}
              <Grid mb="xl">
                <Grid.Col span={6}>
                  <FormTextArea
                    label="Commodity Description"
                    placeholder="Enter commodity description"
                    minRows={3}
                    maxRows={10}
                    autosize
                    resize="vertical"
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
                    placeholder="Enter marks and numbers"
                    minRows={3}
                    maxRows={10}
                    autosize
                    resize="vertical"
                    value={form.values.marks_no}
                    onChange={(e) => {
                      form.setFieldValue("marks_no", e.currentTarget.value);
                    }}
                    error={form.errors.marks_no}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Radio.Group
                    label="Hazardous Cargo"
                    value={form.values.is_hazardous ? "true" : "false"}
                    onChange={(value) =>
                      form.setFieldValue("is_hazardous", value === "true")
                    }
                    styles={{
                      root: {
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#424242",
                        marginBottom: "4px",
                      },
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

              {/* Service-specific Cargo Details - Only show when service is selected */}
              {form.values.service && (
                <>
                  <Text size="sm" fw={500} mb="md" c="#105476">
                    Cargo Details for{" "}
                    {form.values.service_name || form.values.service}
                  </Text>

                  {/* AIR Service Cargo Details - Single Fields && INLAND */}
                  {(form.values.service === "AIR" ||
                    form.values.service === "INLAND") && (
                    <Grid gutter={"sm"}>
                      <Grid.Col span={2.4}>
                        <BookingPackageTypeDropdown
                          value={form.values.cargo_details[0]?.package_type}
                          onChange={(value) =>
                            form.setFieldValue(
                              "cargo_details.0.package_type",
                              value,
                            )
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={2.4}>
                        <FormNumberInput
                          label="No of Packages"
                          placeholder="Enter number of packages"
                          required
                          min={1}
                          {...form.getInputProps(
                            "cargo_details.0.no_of_packages",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={2.4}>
                        <FormNumberInput
                          label="Gross Weight (kg)"
                          placeholder="Enter gross weight"
                          required
                          min={0}
                          decimalScale={3}
                          {...form.getInputProps(
                            "cargo_details.0.gross_weight",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={2.4}>
                        <FormNumberInput
                          label="Volume Weight (kg)"
                          placeholder="Enter volume weight"
                          min={0}
                          decimalScale={3}
                          {...form.getInputProps(
                            "cargo_details.0.volume_weight",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={2.4}>
                        <FormNumberInput
                          label="Chargeable Weight (kg)"
                          // placeholder="Auto-calculated"
                          min={0}
                          decimalScale={3}
                          readOnly
                          {...form.getInputProps(
                            "cargo_details.0.chargeable_weight",
                          )}
                        />
                      </Grid.Col>
                    </Grid>
                  )}

                  {/* LCL Service Cargo Details - Single Fields */}
                  {form.values.service === "LCL" && (
                    <Grid gutter={"sm"}>
                      <Grid.Col span={2.4}>
                        <BookingPackageTypeDropdown
                          value={form.values.cargo_details[0]?.package_type}
                          onChange={(value) =>
                            form.setFieldValue(
                              "cargo_details.0.package_type",
                              value,
                            )
                          }
                        />
                      </Grid.Col>
                      <Grid.Col span={2.4}>
                        <FormNumberInput
                          label="No of Packages"
                          placeholder="Enter number of packages"
                          min={1}
                          {...form.getInputProps(
                            "cargo_details.0.no_of_packages",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={2.4}>
                        <FormNumberInput
                          label="Gross Weight (kg)"
                          placeholder="Enter gross weight"
                          min={0}
                          decimalScale={3}
                          {...form.getInputProps(
                            "cargo_details.0.gross_weight",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={2.4}>
                        <FormNumberInput
                          label="Volume (cbm)"
                          placeholder="Enter volume"
                          min={0}
                          decimalScale={3}
                          {...form.getInputProps("cargo_details.0.volume")}
                        />
                      </Grid.Col>
                      <Grid.Col span={2.4}>
                        <FormNumberInput
                          label="Chargeable Volume (cbm)"
                          // placeholder="Auto-calculated"
                          min={0}
                          decimalScale={3}
                          readOnly
                          {...form.getInputProps(
                            "cargo_details.0.chargeable_volume",
                          )}
                        />
                      </Grid.Col>
                    </Grid>
                  )}

                  {/* FCL Service Cargo Details */}
                  {form.values.service === "FCL" && (
                    <Stack gap="sm">
                      {form.values.cargo_details.map((_, cargoIndex) => (
                        <Box key={cargoIndex}>
                          <Grid gutter={"sm"}>
                            <Grid.Col span={2.4}>
                              <Dropdown
                                label="Container Type"
                                placeholder="Select container type"
                                searchable
                                required
                                data={containerTypeOptions}
                                nothingFoundMessage="No container types found"
                                {...form.getInputProps(
                                  `cargo_details.${cargoIndex}.container_type_code`,
                                )}
                              />
                            </Grid.Col>
                            <Grid.Col span={2.4}>
                              <BookingPackageTypeDropdown
                                value={
                                  form.values.cargo_details[cargoIndex]
                                    ?.package_type
                                }
                                onChange={(value) =>
                                  form.setFieldValue(
                                    `cargo_details.${cargoIndex}.package_type`,
                                    value,
                                  )
                                }
                              />
                            </Grid.Col>
                            <Grid.Col span={2.4}>
                              <FormNumberInput
                                label="No of Containers"
                                placeholder="Enter number of containers"
                                required
                                min={1}
                                {...form.getInputProps(
                                  `cargo_details.${cargoIndex}.no_of_containers`,
                                )}
                              />
                            </Grid.Col>
                            <Grid.Col span={2.4}>
                              <FormNumberInput
                                label="Gross Weight (kg)"
                                placeholder="Enter gross weight"
                                min={0}
                                decimalScale={3}
                                {...form.getInputProps(
                                  `cargo_details.${cargoIndex}.gross_weight`,
                                )}
                              />
                            </Grid.Col>
                            {/* Add/Remove buttons */}
                            <Grid.Col
                              span={2.4}
                              style={{
                                //   display: "flex",
                                gap: "8px",
                                //   justifyContent: "flex-end",
                                marginTop: "25px",
                              }}
                            >
                              {cargoIndex ===
                                form.values.cargo_details.length - 1 && (
                                <Button
                                  variant="light"
                                  color="#105476"
                                  size="xs"
                                  onClick={() => {
                                    form.insertListItem("cargo_details", {
                                      no_of_packages: undefined,
                                      package_type: "",
                                      gross_weight: undefined,
                                      volume_weight: undefined,
                                      chargeable_weight: undefined,
                                      volume: undefined,
                                      chargeable_volume: undefined,
                                      container_type_code: undefined,
                                      no_of_containers: undefined,
                                    });
                                  }}
                                >
                                  <IconPlus size={14} />
                                </Button>
                              )}
                              {form.values.cargo_details.length > 1 && (
                                <Button
                                  variant="light"
                                  color="red"
                                  size="xs"
                                  onClick={() =>
                                    form.removeListItem(
                                      "cargo_details",
                                      cargoIndex,
                                    )
                                  }
                                >
                                  <IconTrash size={14} />
                                </Button>
                              )}
                            </Grid.Col>
                          </Grid>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </>
              )}
            </Box>
          )}

          {/* Step 4: Pickup/Delivery */}
          {active === 3 && (
            <Box>
              {/* Pickup Details Section */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Pickup Details
              </Text>

              <Grid mb="lg" gutter={"sm"}>
                {/* Row 1: Pickup Location & Pickup From */}
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Pickup Location"
                    placeholder="Enter pickup location"
                    value={form.values.pickup_location}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      form.setFieldValue("pickup_location", formattedValue);
                    }}
                    error={form.errors.pickup_location}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Pickup From"
                    placeholder="Type port name or code"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_code", "port_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={form.values.pickup_from_code}
                    displayValue={pickupFromDisplayName}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("pickup_from_code", value || "");
                      if (value && selectedData) {
                        setPickupFromDisplayName(selectedData.label);
                      } else {
                        setPickupFromDisplayName(null);
                      }
                    }}
                    error={form.errors.pickup_from_code as string}
                    minSearchLength={2}
                  />
                </Grid.Col>

                {/* Row 2: Pickup Address & Planned Pickup Date */}
                <Grid.Col span={12}>
                  <SearchableSelect
                    label="Pickup Address"
                    placeholder="Type pickup address"
                    apiEndpoint={URL.allCustomers}
                    searchFields={["customer_code", "customer_name"]}
                    displayFormat={(item: Record<string, unknown>) => {
                      // Get the first address from addresses_data
                      const addressesData =
                        (item.addresses_data as Array<
                          Record<string, unknown>
                        >) || [];
                      const firstAddress = addressesData[0];
                      if (firstAddress) {
                        return {
                          value: String(firstAddress.id),
                          label: `${firstAddress.address} - ${item.customer_name}`,
                        };
                      }
                      return {
                        value: String(item.id || ""),
                        label: String(item.customer_name || ""),
                      };
                    }}
                    value={
                      form.values.pickup_address_id
                        ? String(form.values.pickup_address_id)
                        : ""
                    }
                    displayValue={pickupAddressDisplayName}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("pickup_address_id", value || "");
                      if (value && selectedData) {
                        setPickupAddressDisplayName(selectedData.label);
                      } else {
                        setPickupAddressDisplayName(null);
                      }
                    }}
                    error={form.errors.pickup_address_id as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <SingleDateInput
                    label="Planned Pickup Date"
                    placeholder="YYYY-MM-DD"
                    value={form.values.planned_pickup_date}
                    onChange={(date) => {
                      form.setFieldValue(
                        "planned_pickup_date",
                        date ?? new Date(),
                      );
                    }}
                  />
                </Grid.Col>

                {/* Row 3: Actual Pickup Date, Transporter Name, Transporter Email */}
                <Grid.Col span={3}>
                  <SingleDateInput
                    label="Actual Pickup Date"
                    placeholder="YYYY-MM-DD"
                    value={form.values.actual_pickup_date}
                    onChange={(date) => {
                      form.setFieldValue("actual_pickup_date", date);
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <SearchableSelect
                    label="Transporter Name"
                    placeholder="Type transporter / customer name"
                    apiEndpoint={URL.transporter}
                    searchFields={["customer_code", "customer_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.transporter_code}
                    displayValue={form.values.transporter_name}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("transporter_code", value || "");
                      form.setFieldValue(
                        "transporter_name",
                        selectedData?.label || "",
                      );
                    }}
                    error={form.errors.transporter_code as string}
                    minSearchLength={2}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <FormTextInput
                    label="Transporter Email Id"
                    placeholder="Enter transporter email"
                    type="email"
                    format="normal"
                    {...form.getInputProps("transporter_email")}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="lg" />

              {/* Delivery Details Section */}
              <Text size="sm" fw={500} mb="sm" mt="lg" c="#105476">
                Delivery Details
              </Text>
              <Grid gutter={"sm"}>
                {/* Delivery Location & Delivery From */}
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Delivery Location"
                    placeholder="Enter delivery location"
                    value={form.values.delivery_location}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      form.setFieldValue("delivery_location", formattedValue);
                    }}
                    error={form.errors.delivery_location}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Delivery From"
                    placeholder="Type port name or code"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_code", "port_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={form.values.delivery_from_code}
                    displayValue={deliveryFromDisplayName}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("delivery_from_code", value || "");
                      if (value && selectedData) {
                        setDeliveryFromDisplayName(selectedData.label);
                      } else {
                        setDeliveryFromDisplayName(null);
                      }
                    }}
                    error={form.errors.delivery_from_code as string}
                    minSearchLength={2}
                  />
                </Grid.Col>

                {/* Delivery Address */}
                <Grid.Col span={12}>
                  <SearchableSelect
                    label="Delivery Address"
                    placeholder="Type delivery address"
                    apiEndpoint={URL.allCustomers}
                    searchFields={["customer_code", "customer_name"]}
                    displayFormat={(item: Record<string, unknown>) => {
                      // Get the first address from addresses_data
                      const addressesData =
                        (item.addresses_data as Array<
                          Record<string, unknown>
                        >) || [];
                      const firstAddress = addressesData[0];
                      if (firstAddress) {
                        return {
                          value: String(firstAddress.id),
                          label: `${firstAddress.address} - ${item.customer_name}`,
                        };
                      }
                      return {
                        value: String(item.id || ""),
                        label: String(item.customer_name || ""),
                      };
                    }}
                    value={
                      form.values.delivery_address_id
                        ? String(form.values.delivery_address_id)
                        : ""
                    }
                    displayValue={deliveryAddressDisplayName}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("delivery_address_id", value || "");
                      if (value && selectedData) {
                        setDeliveryAddressDisplayName(selectedData.label);
                      } else {
                        setDeliveryAddressDisplayName(null);
                      }
                    }}
                    error={form.errors.delivery_address_id as string}
                    minSearchLength={3}
                  />
                </Grid.Col>

                {/* Planned & Actual Delivery Dates */}
                <Grid.Col span={3}>
                  <SingleDateInput
                    label="Planned Delivery Date"
                    placeholder="YYYY-MM-DD"
                    value={form.values.planned_delivery_date}
                    onChange={(date) => {
                      form.setFieldValue(
                        "planned_delivery_date",
                        date ?? new Date(),
                      );
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <SingleDateInput
                    label="Actual Delivery Date"
                    placeholder="YYYY-MM-DD"
                    value={form.values.actual_delivery_date}
                    onChange={(date) => {
                      form.setFieldValue("actual_delivery_date", date);
                    }}
                  />
                </Grid.Col>
              </Grid>
            </Box>
          )}

          {/* Step 5: Rate Details */}
          {active === 4 && (
            <Box>
              {/* Quotation/Contract No - Separate common field */}
              <Grid mb="md">
                <Grid.Col span={4}>
                  {quotationOptions && quotationOptions.length > 0 ? (
                    <Dropdown
                      label="Quotation/Contract No"
                      placeholder="Select quotation"
                      searchable
                      data={quotationOptions}
                      value={quotationId}
                      disabled={isEditMode}
                      onChange={(value) => {
                        if (isEditMode) return; // Prevent changes in edit mode
                        setQuotationId(value || "");
                        // Map charges when quotation is selected
                        if (
                          value &&
                          quotationsData?.status &&
                          quotationsData.data
                        ) {
                          const selectedQuotation = quotationsData.data.find(
                            (item: QuotationItem) =>
                              String(item.quotation_id) === value,
                          );
                          if (selectedQuotation?.charges) {
                            const mappedCharges = selectedQuotation.charges.map(
                              (charge: QuotationCharge) => ({
                                id: undefined as number | undefined,
                                charge_id:
                                  charge.charge_id != null
                                    ? String(charge.charge_id)
                                    : "",
                                charge_name: String(charge.charge_name || ""),
                                pp_cc: charge.pp_cc
                                  ? String(charge.pp_cc)
                                  : "Prepaid",
                                currency_country_code: String(
                                  charge.currency || "",
                                ),
                                roe: charge.roe ? String(charge.roe) : "",
                                unit: String(charge.unit || ""),
                                no_of_units: charge.no_of_units
                                  ? String(charge.no_of_units)
                                  : "",
                                sell_per_unit: charge.sell_per_unit
                                  ? String(charge.sell_per_unit)
                                  : "",
                                min_sell: charge.min_sell
                                  ? String(charge.min_sell)
                                  : "",
                                cost_per_unit: charge.cost_per_unit
                                  ? String(charge.cost_per_unit)
                                  : "",
                                total_cost: charge.total_cost
                                  ? String(charge.total_cost)
                                  : "",
                                total_sell: charge.total_sell
                                  ? String(charge.total_sell)
                                  : "",
                              }),
                            );
                            setCharges(
                              mapBookingChargesWithUnits(
                                mappedCharges,
                                form.values.service,
                                form.values.cargo_details,
                                unitOptions,
                              ) ?? mappedCharges,
                            );
                          }
                        }
                      }}
                      styles={{
                        label: {
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#105476",
                          marginBottom: 8,
                        },
                      }}
                    />
                  ) : (
                    <FormTextInput
                      format="normal"
                      label="Quotation/Contract No"
                      placeholder="Enter quotation number"
                      value={quotationId}
                      onChange={(event) =>
                        setQuotationId(event.currentTarget.value)
                      }
                      disabled={isEditMode}
                      styles={{
                        label: {
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#105476",
                          marginBottom: 8,
                        },
                      }}
                    />
                  )}
                </Grid.Col>
              </Grid>

              {/* Charges Table */}
              <Stack justify="lg" px={0}>
                {charges.length > 0 && (
                  <Grid
                    style={{
                      fontWeight: 600,
                      color: "#105476",
                    }}
                    gutter="sm"
                  >
                    <Grid.Col span={1.5}>
                      <RequiredLabel label="Charge Name" required={false} />
                    </Grid.Col>
                    <Grid.Col span={0.95}>
                      <RequiredLabel label="PP/CC" required={false} />
                    </Grid.Col>
                    <Grid.Col span={0.8}>
                      <RequiredLabel label="Currency" required={false} />
                    </Grid.Col>
                    <Grid.Col span={0.8}>
                      <RequiredLabel label="ROE" required={false} />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <RequiredLabel label="Unit" required={false} />
                    </Grid.Col>
                    <Grid.Col span={0.8}>
                      <RequiredLabel label="No of Units" required={false} />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <RequiredLabel label="Sell Per Unit" required={false} />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <RequiredLabel label="Min Sell" required={false} />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <RequiredLabel label="Cost Per Unit" required={false} />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <RequiredLabel
                        label={`Total Sell (${defaultCurrency})`}
                        required={false}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.05}>
                      <RequiredLabel
                        label={`Total Cost (${defaultCurrency})`}
                        required={false}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.1}>
                      <RequiredLabel label="Actions" required={false} />
                    </Grid.Col>
                  </Grid>
                )}
                {charges.map((charge, index) => (
                  <Box key={`charge-row-${index}`}>
                    <Grid gutter="sm">
                      <Grid.Col span={1.5}>
                        <SearchableSelect
                          apiEndpoint={URL.chargeMaster}
                          placeholder="Charge Name"
                          dropdownZIndex={1000}
                          value={charge.charge_id || null}
                          displayValue={charge.charge_name || null}
                          minSearchLength={1}
                          size="xs"
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.id ?? ""),
                            label: String(item.charge_name ?? ""),
                          })}
                          returnOriginalData
                          onChange={(val, selectedItem, originalData) => {
                            setCharges((prev) =>
                              prev.map((c, i) => {
                                if (i !== index) return c;
                                const next = {
                                  ...c,
                                  charge_id: val ?? "",
                                  charge_name: val
                                    ? (selectedItem?.label ?? "")
                                    : "",
                                };
                                if (!val) return next;
                                const defaultUnitCode =
                                  resolveAutoUnitForNewCharge({
                                    calculationType: (
                                      originalData as {
                                        calculation_type?: string;
                                      } | null
                                    )?.calculation_type,
                                    service: form.values.service,
                                    currentUnit: c.unit,
                                  });
                                if (!defaultUnitCode) return next;
                                const unitValue =
                                  findUnitOptionValueByCode(
                                    defaultUnitCode,
                                    unitOptions,
                                  ) ?? defaultUnitCode;
                                // Preserve populated qty; only cargo-fill when empty
                                if (
                                  c.no_of_units != null &&
                                  String(c.no_of_units).trim() !== ""
                                ) {
                                  return { ...next, unit: unitValue };
                                }
                                return applyBookingChargeUnitChange(
                                  next,
                                  unitValue,
                                  form.values.service,
                                  form.values.cargo_details,
                                  unitOptions,
                                );
                              }),
                            );
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Prepaid/Collect"
                          searchable
                          data={["Prepaid", "Collect"]}
                          value={charge.pp_cc}
                          onChange={(value) =>
                            updateCharge(index, "pp_cc", value || "")
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={0.8}>
                        <Dropdown
                          placeholder="Select Currency"
                          searchable
                          value={charge.currency_country_code}
                          onChange={(value) =>
                            bookingRoe.handleCurrencyChange(
                              index,
                              value || "",
                              updateCharge,
                            )
                          }
                          data={currencyOptions}
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={0.8}>
                        <FormNumberInput
                          placeholder="ROE"
                          value={charge.roe}
                          readOnly={bookingRoe.isChargeBaseCurrency(
                            charge.currency_country_code,
                          )}
                          onChange={(val) =>
                            bookingRoe.handleRoeChange(
                              index,
                              val || "",
                              updateCharge,
                            )
                          }
                          error={bookingRoe.chargeRoeErrors[index]}
                          size="xs"
                          decimalScale={ROE_DECIMAL_PLACES}
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Select Unit"
                          searchable
                          value={charge.unit}
                          onChange={(value) => {
                            if (value) updateCharge(index, "unit", value);
                          }}
                          onOptionSubmit={(value) => {
                            if (value) updateCharge(index, "unit", value);
                          }}
                          data={unitOptions}
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={0.8}>
                        <FormNumberInput
                          placeholder="0"
                          {...HOUSE_CARGO_WEIGHT_NUMBER_INPUT_PROPS}
                          value={charge.no_of_units}
                          onChange={(val) =>
                            updateCharge(index, "no_of_units", val || "")
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          placeholder="0.00"
                          value={charge.sell_per_unit}
                          decimalScale={currencyAmountDecimalScale}
                          onChange={(val) =>
                            updateCharge(index, "sell_per_unit", val || "")
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          placeholder="0.00"
                          value={charge.min_sell}
                          decimalScale={currencyAmountDecimalScale}
                          onChange={(val) =>
                            updateCharge(index, "min_sell", val || "")
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          placeholder="0.00"
                          value={charge.cost_per_unit}
                          decimalScale={currencyAmountDecimalScale}
                          onChange={(val) =>
                            updateCharge(index, "cost_per_unit", val || "")
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          value={charge.total_sell || ""}
                          decimalScale={localAmountDecimalScale}
                          groupThousands
                          readOnly
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          value={charge.total_cost || ""}
                          decimalScale={localAmountDecimalScale}
                          groupThousands
                          readOnly
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1.1}>
                        <Group gap="xs">
                          {index === charges.length - 1 && (
                            <Button
                              radius={"sm"}
                              size="sm"
                              px={12}
                              variant="light"
                              color="#105476"
                              onClick={addNewCharge}
                            >
                              <IconPlus size={16} />
                            </Button>
                          )}
                          {charges.length > 1 ? (
                            <Button
                              variant="light"
                              color="red"
                              size="sm"
                              px={12}
                              onClick={() => removeCharge(index)}
                            >
                              <IconTrash size={16} />
                            </Button>
                          ) : (
                            ""
                          )}
                        </Group>
                      </Grid.Col>
                    </Grid>
                  </Box>
                ))}
              </Stack>

              {/* Totals */}
              <Grid
                style={{
                  fontWeight: 600,
                  color: "#105476",
                  paddingTop: "0.5rem",
                }}
              >
                <Grid.Col span={1} offset={7.9} pl={8}>
                  <Text size="sm" fw={600} mb="md" c="#105476">
                    Total :
                  </Text>
                </Grid.Col>
                <Grid.Col span={1} pl={8}>
                  <Text size="sm" fw={600} mb="md" c="#105476">
                    {formatMoneyAmountForUi(
                      charges.reduce((sum, charge) => {
                        const totalSell = parseFloat(charge.total_sell) || 0;
                        return sum + totalSell;
                      }, 0),
                    )}
                  </Text>
                </Grid.Col>
                <Grid.Col span={1} pl={8}>
                  <Text size="sm" fw={600} mb="md" c="#105476">
                    {formatMoneyAmountForUi(
                      charges.reduce((sum, charge) => {
                        const totalCost = parseFloat(charge.total_cost) || 0;
                        return sum + totalCost;
                      }, 0),
                    )}
                  </Text>
                </Grid.Col>
              </Grid>
            </Box>
          )}
        </Box>
      </Box>
      <Box
        style={{
          borderRadius: "8px",
          backgroundColor: "#FFFFFF",
          minHeight: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "20px 48px 20px 24px",
        }}
      >
        <Group justify="space-between" gap={8}>
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Back to List
          </Button>
          <Button
            variant="outline"
            color="#105476"
            onClick={handlePrevious}
            disabled={active === 0}
          >
            Previous
          </Button>
        </Group>
        <Group justify="space-between" gap={8}>
          <Button
            variant="outline"
            onClick={handleNext}
            color="#105476"
            disabled={active === 4}
          >
            Next
          </Button>
          <Button
            rightSection={
              isSubmitting ? <Loader size={16} /> : <IconCheck size={16} />
            }
            onClick={() => handleSubmit()}
            color="#105476"
            disabled={active === 4 && isSubmitting}
          >
            {isSubmitting
              ? isEditMode
                ? "Updating booking..."
                : "Creating booking..."
              : "Submit"}
          </Button>
        </Group>
      </Box>
    </>
  );
};

export default InlandImportBookingStepper;
