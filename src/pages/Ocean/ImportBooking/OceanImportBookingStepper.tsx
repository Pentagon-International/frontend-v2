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
import FormTextInput from "../../../components/FormTextInput";
import FormNumberInput from "../../../components/FormNumberInput";
import FormTextArea from "../../../components/FormTextArea";
import SingleDateInput from "../../../components/SingleDateInput";
import RequiredLabel from "../../../components/RequiredLabel";
import { useNavigate } from "react-router-dom";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { ToastNotification } from "../../../components";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { getAPICall } from "../../../service/getApiCall";
import { SearchableSelect, Dropdown } from "../../../components";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import useAuthStore from "../../../store/authStore";
import { useDebouncedCallback } from "@mantine/hooks";
import { toTitleCase } from "../../../utils/textFormatter";
import { commonSearchAPI } from "../../../service/searchApi";

interface ImportShipmentStepperProps {
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

interface CargoDetail {
  // Common fields
  id?: number;
  no_of_packages?: number;
  gross_weight?: number;
  volume_weight?: number;
  chargeable_weight?: number;
  volume?: number;
  chargeable_volume?: number;

  // FCL specific fields
  container_type_code?: string;
  no_of_containers?: number;
}

const DEFAULT_CARGO_ROW: CargoDetail = {
  no_of_packages: undefined,
  gross_weight: undefined,
  volume_weight: undefined,
  chargeable_weight: undefined,
  volume: undefined,
  chargeable_volume: undefined,
  container_type_code: undefined,
  no_of_containers: undefined,
};

interface BookingEvent {
  type: string;
  date: string;
}

interface RoutingDetail {
  id?: number | string;
  move_type: string;
  from_location_code: string;
  to_location_code: string;
  etd: Date | null;
  eta: Date | null;
  carrier_code: string;
  from_location_name: string;
  to_location_name: string;
  carrier_name: string;
  flight_no: string | null;
  status: string;
}

interface FormValues {
  // Import Shipment fields
  customer_code: string;
  customer_name: string;
  service: string;
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
  is_direct: boolean;
  is_coload: boolean;
  houseno:string;

  // Ocean Schedule fields
  schedule_id: string;
  carrier_code: string;
  carrier_name: string;
  eta: Date | null;
  etd: Date | null;
  vessel_name: string;
  voyage_no: string;

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
  consignee_address: string;
  consignee_address_id: number;
  consignee_email: string;
  forwarder_code: string;
  forwarder_name: string;
  forwarder_address_id: number;
  forwarder_email: string;
  destination_agent_code: string;
  destination_agent_name: string;
  destination_agent_address_id: number;
  destination_agent_email: string;
  billing_customer_code: string;
  billing_customer_name: string;
  billing_customer_address_id: number;
  notify_customer_code: string;
  notify_customer_name: string;
  notify_customer_address_id: number;
  notify_customer_email: string;
  cha_code: string;
  cha_name: string;
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
  // Import Shipment fields - Only these are required
  customer_code: yup.string().required("Customer is required"),
  service: yup.string().required("Service is required"),
  date: yup.date().required("Date is required"),
  origin_code: yup.string().required("Origin is required"),
  destination_code: yup.string().required("Destination is required"),
  shipment_terms_code: yup.string().required("Shipment terms are required"),
  freight: yup.string().required("Freight is required"),
  routed: yup.string().required("Routed is required"),
  routed_by: yup.string().required("Routed by is required"),
  customer_service_name: yup
    .string()
    .required("Customer service name is required"),
  is_direct: yup.boolean(),
  is_coload: yup.boolean(),
  houseno: yup.string().required("House No is required"),

  // Ocean Schedule fields - All optional
  schedule_id: yup.string(),
  carrier_code: yup.string(),
  eta: yup.date().nullable(),
  etd: yup.date().nullable(),
  vessel_name: yup.string(),
  voyage_no: yup.string(),

  // Routing Details - All optional
  routingDetails: yup.array().of(
    yup.object({
      move_type: yup.string(),
      from_location_code: yup.string(),
      to_location_code: yup.string(),
      etd: yup.date().nullable(),
      eta: yup.date().nullable(),
      carrier_code: yup.string(),
      flight_no: yup.string().nullable(),
      status: yup.string(),
    }),
  ),

  // Party Details fields - All optional
  shipper_code: yup.string(),
  shipper_address_id: yup.number(),
  shipper_email: yup.string().email("Invalid email format"),
  consignee_code: yup.string(),
  consignee_address_id: yup.number(),
  consignee_email: yup.string().email("Invalid email format"),
  forwarder_code: yup.string(),
  forwarder_address_id: yup.number(),
  forwarder_email: yup.string().email("Invalid email format"),
  destination_agent_code: yup.string(),
  destination_agent_address_id: yup.number(),
  destination_agent_email: yup.string().email("Invalid email format"),
  billing_customer_code: yup.string(),
  billing_customer_address_id: yup.number(),
  notify_customer_code: yup.string(),
  notify_customer_address_id: yup.number(),
  notify_customer_email: yup.string().email("Invalid email format"),
  cha_code: yup.string(),
  cha_address_id: yup.number(),

  // Commodity Details - All optional
  is_hazardous: yup.boolean(),
  commodity_description: yup.string(),
  marks_no: yup.string(),
  cargo_details: yup.array().of(
    yup.object({
      no_of_packages: yup.number().nullable(),
      gross_weight: yup.number().nullable(),
      volume_weight: yup.number().nullable(),
      chargeable_weight: yup.number().nullable(),
      volume: yup.number().nullable(),
      chargeable_volume: yup.number().nullable(),
      container_type_code: yup.string().nullable(),
      no_of_containers: yup.number().nullable(),
    }),
  ),

  // Pickup Details - All optional
  pickup_location: yup.string(),
  pickup_from_code: yup.string(),
  pickup_address_id: yup.string(),
  planned_pickup_date: yup.date(),
  actual_pickup_date: yup.date().nullable(),
  transporter_code: yup.string(),
  transporter_name: yup.string(),
  transporter_email: yup.string().email("Invalid email format"),

  // Delivery Details - All optional
  delivery_location: yup.string(),
  delivery_from_code: yup.string(),
  delivery_address_id: yup.string(),
  planned_delivery_date: yup.date(),
  actual_delivery_date: yup.date().nullable(),

  // Events, Documents, Trigger Updates - optional
  events: yup.array().of(
    yup.object({ type: yup.string(), date: yup.string() }),
  ),
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
  const response = await getAPICall(URL.termsOfShipment, API_HEADER);
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

const fetchUnitMaster = async () => {
  try {
    const response = (await postAPICall(
      URL.unitMasterFilter,
      {},
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
  currency?: string;
  currency_country_code?: string;
  roe?: number;
  unit: string;
  no_of_units?: number;
  sell_per_unit?: number;
  min_sell?: number;
  cost_per_unit?: number;
  total_cost?: number;
  total_sell?: number;
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

const OceanImportBookingStepper: React.FC<ImportShipmentStepperProps> = ({
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
  const [internalActive, setInternalActive] = useState(0);
  const active = externalActive !== undefined ? externalActive : internalActive;
  const setActive = externalSetActive || setInternalActive;

  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [charges, setCharges] = useState([
    {
      id: undefined as number | undefined,
      charge_id: "",
      charge_name: "",
      pp_cc: "Collect",
      currency_country_code: "",
      roe: "",
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

  // State for display values
  const [pickupFromDisplayName, setPickupFromDisplayName] = useState<
    string | null
  >(null);
  const [deliveryFromDisplayName, setDeliveryFromDisplayName] = useState<
    string | null
  >(null);
  const [consigneeDisplayName, setConsigneeDisplayName] = useState<
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
  const [chaDisplayName, setChaDisplayName] = useState<string | null>(null);
  const [pickupAddressDisplayName, setPickupAddressDisplayName] = useState<
    string | null
  >(null);
  const [deliveryAddressDisplayName, setDeliveryAddressDisplayName] = useState<
    string | null
  >(null);

  // State for address options
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [agentAddressOptions, setAgentAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [forwarderAddressOptions, setForwarderAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [billingCustomerAddressOptions, setBillingCustomerAddressOptions] =
    useState<Array<{ value: string; label: string }>>([]);
  const [notifyCustomerAddressOptions, setNotifyCustomerAddressOptions] =
    useState<Array<{ value: string; label: string }>>([]);
  const [chaAddressOptions, setChaAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  // Shipment party lookup (Ocean Import: Shipper only) - same pattern as Air Export consignee
  const [shipperSearch, setShipperSearch] = useState("");
  const [shipperOptions, setShipperOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [shipperHasResults, setShipperHasResults] = useState<boolean | null>(
    null,
  );
  const shipperDataRef = useRef<Record<string, Record<string, unknown>>>({});

  const defaultCurrency = (() => {
    const userData = localStorage.getItem("user");
    if (!userData) return "";

    const parsed = JSON.parse(userData);

    return (
      parsed?.branches?.find((b: any) => b.is_default)?.currency
        ?.currency_code || ""
    );
  })();

  // Terms of Shipment query (still needed for the Select component)
  const { data: termsOfShipment = [] } = useQuery({
    queryKey: ["termsOfShipment"],
    queryFn: fetchTermsOfShipment,
    staleTime: 5 * 60 * 1000,
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

  // Unit master query - fetch with empty payload
  const { data: unitDataRaw = [] } = useQuery({
    queryKey: ["unitMaster"],
    queryFn: fetchUnitMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

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

  // Get user data from auth store
  const user = useAuthStore((state) => state.user);

  // Transform terms of shipment data for dropdown
  type TermsOfShipmentData = {
    tos_code: string;
    tos_name: string;
  };

  // Memoized shipment options
  const shipmentOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    if (Array.isArray(termsOfShipment) && termsOfShipment.length > 0) {
      termsOfShipment.forEach((item: TermsOfShipmentData) => {
        options.push({
          value: item.tos_code ? String(item.tos_code) : "",
          label: `${item.tos_name} (${item.tos_code})`,
        });
      });
    }

    // In edit mode, ensure the shipment_terms_code from initialData is in options
    if (isEditMode && initialData) {
      const shipmentTermsCode = String(initialData.shipment_terms_code || "");
      const exists = options.some((opt) => opt.value === shipmentTermsCode);
      if (!exists && shipmentTermsCode && initialData.shipment_terms_name) {
        options.unshift({
          value: shipmentTermsCode,
          label: `${String(initialData.shipment_terms_name)} (${shipmentTermsCode})`,
        });
      }
    }

    return options;
  }, [termsOfShipment, isEditMode, initialData]);

  // const eventTypeOptions = useMemo(
  //   () =>
  //     Array.isArray(eventMasterData)
  //       ? eventMasterData.map((item: Record<string, unknown>) => ({
  //           value: String(item.event_type ?? ""),
  //           label: String(item.event_type ?? ""),
  //         }))
  //       : [],
  //   [eventMasterData],
  // );

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

  // Trigger type has no master data – static options
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

  // Memoized unit options
  const unitOptions = useMemo(() => {
    if (!Array.isArray(unitDataRaw)) return [];
    return unitDataRaw.map((item: unknown) => {
      const unitItem = item as { unit_code?: string };
      return {
        value: String(unitItem.unit_code || ""),
        label: unitItem.unit_code || "",
      };
    });
  }, [unitDataRaw]);

  const updateCharge = (index: number, field: string, value: string) => {
    setCharges(
      charges.map((charge, i) => {
        if (i === index) {
          const updatedCharge = { ...charge, [field]: value };

          // Calculate totals when relevant fields change
          // Formula: sell_per_unit * roe * no_of_units
          if (
            field === "no_of_units" ||
            field === "sell_per_unit" ||
            field === "roe"
          ) {
            const noOfUnits = parseFloat(updatedCharge.no_of_units) || 0;
            const sellPerUnit = parseFloat(updatedCharge.sell_per_unit) || 0;
            const roe = parseFloat(updatedCharge.roe) || 1;

            updatedCharge.total_sell = (sellPerUnit * roe * noOfUnits).toFixed(
              2,
            );
          }

          // Formula: cost_per_unit * roe * no_of_units
          if (
            field === "no_of_units" ||
            field === "cost_per_unit" ||
            field === "roe"
          ) {
            const noOfUnits = parseFloat(updatedCharge.no_of_units) || 0;
            const costPerUnit = parseFloat(updatedCharge.cost_per_unit) || 0;
            const roe = parseFloat(updatedCharge.roe) || 1;

            updatedCharge.total_cost = (costPerUnit * roe * noOfUnits).toFixed(
              2,
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
      pp_cc: "Collect",
      currency_country_code: "",
      roe: "",
      unit: "",
      no_of_units: "",
      sell_per_unit: "",
      min_sell: "",
      cost_per_unit: "",
      total_cost: "",
      total_sell: "",
    };
    setCharges([...charges, newCharge]);
  };

  const removeCharge = (index: number) => {
    if (charges.length > 1) {
      setCharges(charges.filter((_, i) => i !== index));
    }
  };

  // Function to map initial data to form values
  const mapInitialDataToFormValues = (
    data: Record<string, unknown>,
  ): Partial<FormValues> => {
    if (!data) return {};

    console.log("mapInitialDataToFormValues - input data:", data);

    return {
      // Import Shipment fields
      customer_code: String(data.customer_code || ""),
      customer_name: String(data.customer_name || ""),
      service: String(data.service || ""),
      date: data.date ? new Date(String(data.date)) : new Date(),
      origin_code: String(data.origin_code || ""),
      origin_name: String(data.origin_name || ""),
      destination_code: String(data.destination_code || ""),
      destination_name: String(data.destination_name || ""),
      shipment_terms_code: String(data.shipment_terms_code || ""),
      shipment_terms_name: String(data.shipment_terms_name || ""),
      freight: String(data.freight || ""),
      routed: String(data.routed || ""),
      routed_by: String(data.routed_by || ""),
      customer_service_name: String(data.customer_service_name || ""),
      is_direct: Boolean(data.is_direct),
      is_coload: Boolean(data.is_coload),
      houseno: String(data.houseno || ""),

      // Ocean Schedule fields
      schedule_id: String(data.schedule_id || ""),
      carrier_code: String(data.carrier_code || ""),
      carrier_name: String(data.carrier_name || ""),
      eta: data.eta ? new Date(String(data.eta)) : null,
      etd: data.etd ? new Date(String(data.etd)) : null,
      vessel_name: String(data.vessel_name || ""),
      voyage_no: String(data.voyage_no || ""),

      // Routing Details - map from routing_details array
      routingDetails: data.routing_details
        ? (data.routing_details as Array<Record<string, unknown>>).map(
            (route: Record<string, unknown>) => ({
              id: route.id != null ? Number(route.id) : undefined,
              move_type: String(route.move_type || ""),
              from_location_code: String(route.from_location_code || ""),
              to_location_code: String(route.to_location_code || ""),
              from_location_name: String(route.from_location_name || ""),
              to_location_name: String(route.to_location_name || ""),
              carrier_code: String(route.carrier_code || ""),
              carrier_name: String(route.carrier_name || ""),
              etd: route.etd ? new Date(String(route.etd)) : null,
              eta: route.eta ? new Date(String(route.eta)) : null,
              flight_no: route.flight_no ? String(route.flight_no) : null,
              status: String(route.status || ""),
            }),
          )
        : [],

      // Party Details fields - map from the provided data structure
      shipper_code: String(data.shipper_code || ""),
      shipper_name: String(data.shipper_name || ""),
      shipper_address: String(data.shipper_address || data.shipper_address_text || ""),
      shipper_address_id: Number(data.shipper_address_id) || 0,
      shipper_email: String(data.shipper_email || ""),
      consignee_code: String(data.consignee_code || ""),
      consignee_name: String(data.consignee_name || ""),
      consignee_address: String(data.consignee_address || data.consignee_address_text || ""),
      consignee_address_id: Number(data.consignee_address_id) || 0,
      consignee_email: String(data.consignee_email || ""),
      forwarder_code: String(data.forwarder_code || ""),
      forwarder_address_id: Number(data.forwarder_address_id) || 0,
      forwarder_email: String(data.forwarder_email || ""),
      destination_agent_code: String(data.destination_agent_code || ""),
      destination_agent_address_id:
        Number(data.destination_agent_address_id) || 0,
      destination_agent_email: String(data.destination_agent_email || ""),
      billing_customer_code: String(data.billing_customer_code || ""),
      billing_customer_address_id:
        Number(data.billing_customer_address_id) || 0,
      notify_customer_code: String(data.notify_customer_code || ""),
      notify_customer_address_id: Number(data.notify_customer_address_id) || 0,
      notify_customer_email: String(data.notify_customer_email || ""),
      cha_code: String(data.cha_code || ""),
      cha_address_id: Number(data.cha_address_id) || 0,

      // Commodity Details
      is_hazardous: Boolean(data.is_hazardous),
      commodity_description: String(data.commodity_description || ""),
      marks_no: String(data.marks_no || ""),
      cargo_details: data.cargo_details
        ? (data.cargo_details as Array<Record<string, unknown>>).map(
            (cargo: Record<string, unknown>) => ({
              id: cargo.id != null ? Number(cargo.id) : undefined,
              no_of_packages: cargo.no_of_packages
                ? Number(cargo.no_of_packages)
                : undefined,
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
      transporter_code: String(data.transporter_code ?? ""),
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
        ? (data.events as Array<{ type?: string; date?: string }>).map(
            (e) => ({
              type: String(e.type ?? ""),
              date: String(e.date ?? ""),
            }),
          )
        : [],
      document_ids: Array.isArray(data.document_ids)
        ? (data.document_ids as number[]).map((id) => Number(id))
        : Array.isArray(
            (data as { documents?: Array<Record<string, unknown>> }).documents,
          )
          ? (
              (data as { documents?: Array<Record<string, unknown>> })
                .documents as Array<Record<string, unknown>>
            )
              .map((doc) => (doc.id != null ? Number(doc.id) : null))
              .filter((id): id is number => id !== null)
          : [],
      document_display_list: Array.isArray(
        (data as { documents?: Array<Record<string, unknown>> }).documents,
      )
        ? (
            (data as { documents?: Array<Record<string, unknown>> })
              .documents as Array<Record<string, unknown>>
          ).map((doc) => ({
            id: Number(doc.id),
            documentName: String(doc.document_name ?? ""),
            userFileName: String(doc.user_file_name ?? ""),
            document_url:
              doc.document_url != null ? String(doc.document_url) : undefined,
          }))
        : [],
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
      document_modal_rows: Array.isArray(
        (data as { documents?: Array<Record<string, unknown>> }).documents,
      )
        ? (
            (data as { documents?: Array<Record<string, unknown>> })
              .documents as Array<Record<string, unknown>>
          ).map((doc) => ({
            id: doc.id != null ? Number(doc.id) : undefined,
            documentName: String(doc.document_name ?? ""),
            file: null,
            userFileName: String(doc.user_file_name ?? ""),
            document_url:
              doc.document_url != null ? String(doc.document_url) : undefined,
          }))
        : [{ id: undefined, documentName: "", file: null, userFileName: "" }],
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
    initialValues: {
      // Import Shipment fields
      customer_code: "",
      customer_name: "",
      service: "",
      date: new Date(),
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      shipment_terms_code: "",
      shipment_terms_name: "",
      freight: "",
      routed: "",
      routed_by: "",
      customer_service_name: "",
      is_direct: false,
      is_coload: false,
      houseno:"",

      // Ocean Schedule fields
      schedule_id: "",
      carrier_code: "",
      carrier_name: "",
      eta: null,
      etd: null,
      vessel_name: "",
      voyage_no: "",

      // Routing Details - start with one empty row
      routingDetails: [
        {
          move_type: "",
          from_location_code: "",
          to_location_code: "",
          from_location_name: "",
          to_location_name: "",
          carrier_code: "",
          carrier_name: "",
          etd: null,
          eta: null,
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
      consignee_address: "",
      consignee_address_id: 0,
      consignee_email: "",
      forwarder_code: "",
      forwarder_name: "",
      forwarder_address_id: 0,
      forwarder_email: "",
      destination_agent_code: "",
      destination_agent_name: "",
      destination_agent_address_id: 0,
      destination_agent_email: "",
      billing_customer_code: "",
      billing_customer_name: "",
      billing_customer_address_id: 0,
      notify_customer_code: "",
      notify_customer_name: "",
      notify_customer_address_id: 0,
      notify_customer_email: "",
      cha_code: "",
      cha_name: "",
      cha_address_id: 0,

      // Commodity Details
      is_hazardous: false,
      commodity_description: "",
      marks_no: "",
      cargo_details: [
        {
          no_of_packages: undefined,
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
        { id: undefined, documentName: "", file: null, userFileName: "" },
      ],
      trigger_modal_rows: [
        { id: undefined, type: null, code: null, description: "" },
      ],

      // Merge with initial data when provided (edit mode or create-from-quotation)
      ...(initialData ? mapInitialDataToFormValues(initialData) : {}),
    },
  });

  // Events, Documents, Trigger Updates – form-based handlers (mirroring export booking)
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);

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

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const downloadDocumentFile = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addDocumentRow = () => {
    form.insertListItem("document_modal_rows", {
      id: undefined,
      documentName: "",
      file: null,
      userFileName: "",
    });
  };

  const updateDocumentRow = (
    index: number,
    field: "documentName" | "file" | "document_url",
    value: string | File | null | undefined,
  ) => {
    form.setFieldValue(`document_modal_rows.${index}.${field}`, value);
  };

  const removeDocumentRow = (index: number) => {
    if (form.values.document_modal_rows.length > 1) {
      form.removeListItem("document_modal_rows", index);
    }
  };

  const handleSubmitDocumentsModal = async () => {
    const rows = form.values.document_modal_rows;
    const items = rows
      .map((row, index) => ({ row, index }))
      .filter(
        (item) =>
          item.row.documentName.trim() &&
          (item.row.id != null || item.row.file != null),
      );
    const invalid = rows.some(
      (r) =>
        (r.documentName.trim() && !r.file && r.id == null) ||
        (!r.documentName.trim() && (r.file || r.id != null)),
    );
    if (invalid) {
      ToastNotification({
        type: "warning",
        message:
          "Each row must have document name and either an existing document or a new file",
      });
      return;
    }
    if (items.length === 0) {
      ToastNotification({
        type: "warning",
        message:
          "Please add at least one document (name + file) or leave all rows empty",
      });
      return;
    }
    setDocumentUploading(true);
    try {
      const formData = new FormData();
      items.forEach(({ row }, i) => {
        formData.append(`document_names[${i}]`, row.documentName.trim());
        if (row.file != null) {
          formData.append(`documents[${i}]`, row.file);
        }
        if (row.id != null) {
          // Backend expects `document_id[index]` for existing docs
          formData.append(`document_id[${i}]`, String(row.id));
        }
      });

      const headers = {
        "Content-Type": "multipart/form-data",
        ...API_HEADER.headers,
      };

      const response = (await postAPICall(URL.uploadDocument, formData, {
        headers,
      })) as { success?: boolean; data?: unknown; message?: string };

      if (response?.success) {
        type DocumentItem = {
          id?: number;
          document_name?: string;
          document_url?: string;
          user_file_name?: string;
        };

        const raw = response.data as
          | { documents?: DocumentItem[] }
          | DocumentItem[]
          | DocumentItem
          | undefined;

        let normalized: DocumentItem[] = [];
        if (raw && Array.isArray((raw as { documents?: DocumentItem[] }).documents)) {
          normalized = (raw as { documents?: DocumentItem[] }).documents ?? [];
        } else if (Array.isArray(raw)) {
          normalized = raw as DocumentItem[];
        } else if (raw) {
          normalized = [raw as DocumentItem];
        }

        const newIds = normalized
          .filter((d) => d.id != null)
          .map((d) => Number(d.id!));
        const updatedDisplayList = normalized.map((d) => ({
          id: Number(d.id ?? 0),
          documentName: String(d.document_name ?? ""),
          userFileName: String(d.user_file_name ?? ""),
          document_url:
            d.document_url != null ? String(d.document_url) : undefined,
        }));

        // After an upload call, treat the response as the single source of truth
        // for the current document set to avoid duplicating existing documents.
        form.setFieldValue("document_ids", newIds);
        form.setFieldValue("document_display_list", updatedDisplayList);
        const modalRowsFromDisplay = updatedDisplayList.map((d) => ({
          id: d.id,
          documentName: d.documentName,
          file: null as File | null,
          userFileName: d.userFileName ?? "",
          document_url: d.document_url,
        }));
        form.setFieldValue("document_modal_rows", [
          ...modalRowsFromDisplay,
          {
            id: undefined,
            documentName: "",
            file: null,
            userFileName: "",
          },
        ]);
        ToastNotification({
          type: "success",
          message: "Document(s) saved successfully",
        });
        setDocumentsModalOpen(false);
      } else {
        ToastNotification({
          type: "error",
          message:
            (response as { message?: string })?.message ??
            "Upload failed for one or more documents",
        });
      }
    } catch (err) {
      console.error("Document upload error:", err);
      ToastNotification({
        type: "error",
        message: "Failed to upload document(s)",
      });
    } finally {
      setDocumentUploading(false);
    }
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
    const toAdd: { id?: number; type: string; code: string; description: string }[] = [];
    for (const row of rows) {
      if (row.type && row.code) {
        const item: { id?: number; type: string; code: string; description: string } = {
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
    queryFn: () => fetchSalespersons(form.values.customer_code || ""),
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

    return response.data.map((item: SalespersonData) => ({
      value: item.sales_person ? String(item.sales_person) : "",
      label: item.sales_person,
      sales_coordinator: item.sales_coordinator || "",
      customer_service: item.customer_service || "",
    }));
  }, [rawSalespersonsData]);

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
          form.values.service,
        ],
    queryFn: () =>
      isFromQuotationFlow
        ? fetchQuotations({ quotation_id: quotationPrimaryId! })
        : fetchQuotations({
            customer_code: form.values.customer_code,
            origin_code: form.values.origin_code,
            destination_code: form.values.destination_code,
            service: form.values.service,
            service_type: "Import", // Ocean Import
          }),
    enabled: isFromQuotationFlow
      ? !!quotationPrimaryId
      : !!form.values.customer_code &&
        !!form.values.origin_code &&
        !!form.values.destination_code &&
        !!form.values.service,
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
          pp_cc: charge.pp_cc ? String(charge.pp_cc) : "Collect",
          currency_country_code: String(charge.currency || charge.currency_country_code || ""),
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
      setCharges(mappedCharges);
    }
  }, [isFromQuotationFlow, quotationsData, onQuotationAlreadyBooked]);

  const debouncedShipperSearch = useDebouncedCallback(async (term: string) => {
    const query = term.trim();
    if (!query || query.length < 2) {
      setShipperOptions([]);
      setShipperHasResults(null);
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
        shipperDataRef.current = {};
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
      setShipperHasResults(true);
    } catch (error) {
      console.error("Shipper shipment-party search failed:", error);
      setShipperOptions([]);
      setShipperHasResults(null);
      shipperDataRef.current = {};
    }
  }, 500);

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

    if (jobData.shipper_name) {
      form.setFieldValue("shipper_name", String(jobData.shipper_name));
      setShipperSearch(String(jobData.shipper_name));
    }
    if (jobData.shipper_address) {
      form.setFieldValue("shipper_address", String(jobData.shipper_address));
    } else if (jobData.shipper_address_text) {
      form.setFieldValue(
        "shipper_address",
        String(jobData.shipper_address_text),
      );
    }
    if (jobData.consignee_name) {
      setConsigneeDisplayName(String(jobData.consignee_name));
      form.setFieldValue("consignee_name", String(jobData.consignee_name));
    }
    if (jobData.consignee_address)
      form.setFieldValue("consignee_address", String(jobData.consignee_address));
    if (jobData.forwarder_name)
      setForwarderDisplayName(String(jobData.forwarder_name));
    if (jobData.destination_agent_name)
      setDestinationAgentDisplayName(String(jobData.destination_agent_name));
    if (jobData.billing_customer_name)
      setBillingCustomerDisplayName(String(jobData.billing_customer_name));
    else if (jobData.billing_customer)
      setBillingCustomerDisplayName(String(jobData.billing_customer));
    if (jobData.notify_customer_name)
      setNotifyCustomerDisplayName(String(jobData.notify_customer_name));
    else if (jobData.notify_customer)
      setNotifyCustomerDisplayName(String(jobData.notify_customer));
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

    if (jobData.consignee_address || jobData.consignee_address_id != null) {
      setConsigneeAddressOptions([
        {
          value: String(jobData.consignee_address_id ?? 0),
          label: String(jobData.consignee_address ?? ""),
        },
      ]);
      form.setFieldValue(
        "consignee_address_id",
        Number(jobData.consignee_address_id) || 0,
      );
    }
    if (jobData.forwarder_address_id && jobData.forwarder_address) {
      setForwarderAddressOptions([
        {
          value: String(jobData.forwarder_address_id),
          label: String(jobData.forwarder_address),
        },
      ]);
    }
    if (
      jobData.destination_agent_address_id &&
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
      jobData.billing_customer_address_id &&
      jobData.billing_customer_address
    ) {
      setBillingCustomerAddressOptions([
        {
          value: String(jobData.billing_customer_address_id),
          label: String(jobData.billing_customer_address),
        },
      ]);
    }
    if (jobData.notify_customer_address_id && jobData.notify_customer_address) {
      setNotifyCustomerAddressOptions([
        {
          value: String(jobData.notify_customer_address_id),
          label: String(jobData.notify_customer_address),
        },
      ]);
    }
    if (jobData.cha_address_id && jobData.cha_address) {
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
        id: charge.id != null ? (typeof charge.id === "number" ? charge.id : Number(charge.id)) : undefined,
        charge_id: charge.charge_id != null ? String(charge.charge_id) : "",
        charge_name: String(charge.charge_name ?? ""),
        pp_cc: String(charge.pp_cc ?? "Collect"),
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
      setCharges(mappedCharges);
    }
    if (jobData.shipment_terms_code && jobData.shipment_terms_name) {
      form.setFieldValue(
        "shipment_terms_name",
        String(jobData.shipment_terms_name),
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
      form.setFieldValue("shipper_name", String(initialData.shipper_name));
      setShipperSearch(String(initialData.shipper_name));
    }
    if (initialData.shipper_address) {
      form.setFieldValue("shipper_address", String(initialData.shipper_address));
    } else if (initialData.shipper_address_text) {
      form.setFieldValue(
        "shipper_address",
        String(initialData.shipper_address_text),
      );
    }
    if (initialData.consignee_name) {
      setConsigneeDisplayName(String(initialData.consignee_name));
      form.setFieldValue("consignee_name", String(initialData.consignee_name));
    }
    if (initialData.consignee_address) {
      form.setFieldValue("consignee_address", String(initialData.consignee_address));
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
    // Notify Customer - check for both notify_customer_name and notify_customer
    if (initialData.notify_customer_name) {
      setNotifyCustomerDisplayName(String(initialData.notify_customer_name));
    } else if (initialData.notify_customer) {
      setNotifyCustomerDisplayName(String(initialData.notify_customer));
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
    // Consignee Address (from quotation list address string or with id)
    if (initialData.consignee_address) {
      form.setFieldValue("consignee_address", String(initialData.consignee_address));
      setConsigneeAddressOptions([
        {
          value: String(initialData.consignee_address_id || 0),
          label: String(initialData.consignee_address),
        },
      ]);
      form.setFieldValue(
        "consignee_address_id",
        Number(initialData.consignee_address_id) || 0,
      );
    }

    // Forwarder Address
    if (initialData.forwarder_address_id && initialData.forwarder_address) {
      setForwarderAddressOptions([
        {
          value: String(initialData.forwarder_address_id),
          label: String(initialData.forwarder_address),
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

    // Notify Customer Address
    if (
      initialData.notify_customer_address_id &&
      initialData.notify_customer_address
    ) {
      setNotifyCustomerAddressOptions([
        {
          value: String(initialData.notify_customer_address_id),
          label: String(initialData.notify_customer_address),
        },
      ]);
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

    // Ensure shipment_terms_name is set if shipment_terms_code exists
    if (initialData.shipment_terms_code && initialData.shipment_terms_name) {
      form.setFieldValue(
        "shipment_terms_name",
        String(initialData.shipment_terms_name),
      );
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
        (charge: Record<string, unknown>) => ({
          id: charge.id != null ? (typeof charge.id === "number" ? charge.id : Number(charge.id)) : undefined,
          charge_id: charge.charge_id != null ? String(charge.charge_id) : "",
          charge_name: String(charge.charge_name || ""),
          pp_cc: String(charge.pp_cc ?? "Collect"),
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
        }),
      );
      setCharges(mappedCharges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, initialData, jobData]);

  // Sync shipment_terms_name when shipment_terms_code or shipmentOptions changes
  useEffect(() => {
    if (form.values.shipment_terms_code && shipmentOptions.length > 0) {
      const option = shipmentOptions.find(
        (opt) => opt.value === form.values.shipment_terms_code,
      );
      if (option) {
        const nameFromLabel = option.label.split(" (")[0];
        if (form.values.shipment_terms_name !== nameFromLabel) {
          form.setFieldValue("shipment_terms_name", nameFromLabel);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentOptions, form.values.shipment_terms_code]);

  // Auto-set routed_by when routed is "self" and user data is available
  useEffect(() => {
    if (
      form.values.routed === "Self" &&
      user?.full_name &&
      !form.values.routed_by
    ) {
      form.setFieldValue("routed_by", user.full_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.routed, user?.full_name]);

  // Auto-set customer_service_name in self mode
  useEffect(() => {
    if (form.values.routed !== "Self") return;

    // For create-from-quotation flow, default customer_service_name to logged-in user
    if (isFromQuotationFlow && user?.full_name && !form.values.customer_service_name) {
      form.setFieldValue("customer_service_name", user.full_name);
      return;
    }

    // Fallback: derive customer_service_name from selected salesperson
    if (form.values.routed_by && salespersonsData.length > 0) {
      const selectedSalesperson = salespersonsData.find(
        (person) => person.value === form.values.routed_by,
      );
      if (selectedSalesperson?.customer_service) {
        form.setFieldValue(
          "customer_service_name",
          selectedSalesperson.customer_service,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.routed, form.values.routed_by, form.values.customer_service_name, salespersonsData]);

  // Clear routed_by and customer_service_name when routed changes to "Agent"
  useEffect(() => {
    if (form.values.routed === "Agent") {
      form.setFieldValue("routed_by", "");
      form.setFieldValue("customer_service_name", "");
    }
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
    } else if (form.values.service === "AIR") {
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
      ];

      const validation = form.validate();
      console.log("validation check---", validation);

      // Check if any required fields have errors
      const hasRequiredFieldErrors = requiredFields.some(
        (field) => validation.errors[field],
      );

      if (hasRequiredFieldErrors) {
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

      // Helper function to format dates to YYYY-MM-DD
      const formatDate = (dateValue: Date | string | null | undefined) => {
        if (!dateValue) return "";
        if (typeof dateValue === "string") {
          // If it's already a string, try to parse and format
          const date = new Date(dateValue);
          return date.toISOString().split("T")[0];
        }
        if (dateValue instanceof Date) {
          return dateValue.toISOString().split("T")[0];
        }
        return "";
      };

      // Transform form data to match API payload structure
      const payload: Record<string, unknown> = {
        customer_code: form.values.customer_code,
        service: form.values.service,
        date: formatDate(form.values.date),
        origin_code: form.values.origin_code,
        destination_code: form.values.destination_code,
        shipment_terms_code: form.values.shipment_terms_code,
        freight: form.values.freight,
        routed: form.values.routed,
        routed_by: form.values.routed_by,
        customer_service_name: form.values.customer_service_name,
        is_direct: form.values.is_direct,
        is_coload: form.values.is_coload,
        houseno: form.values.houseno,

        schedule_id: form.values.schedule_id,
        carrier_code: form.values.carrier_code,
        eta: formatDate(form.values.eta),
        etd: formatDate(form.values.etd),
        vessel_name: form.values.vessel_name,
        voyage_no: form.values.voyage_no,

        // Party Details - shipper and consignee use name/address/email (text only)
        shipper_name: form.values.shipper_name || "",
        shipper_address: form.values.shipper_address || "",
        shipper_email: form.values.shipper_email || "",

        consignee_name: form.values.consignee_name || "",
        consignee_address: form.values.consignee_address || "",
        consignee_email: form.values.consignee_email || "",

        forwarder_code: form.values.forwarder_code || "",
        forwarder_address_id: Number(form.values.forwarder_address_id) || 0,
        forwarder_email: form.values.forwarder_email || "",

        destination_agent_code: form.values.destination_agent_code || "",
        destination_agent_address_id:
          Number(form.values.destination_agent_address_id) || 0,
        destination_agent_email: form.values.destination_agent_email || "",

        billing_customer_code: form.values.billing_customer_code || "",
        billing_customer_address_id:
          Number(form.values.billing_customer_address_id) || 0,

        notify_customer_code: form.values.notify_customer_code || "",
        notify_customer_address_id:
          Number(form.values.notify_customer_address_id) || 0,
        notify_customer_email: form.values.notify_customer_email || "",

        cha_code: form.values.cha_code || "",
        cha_address_id: Number(form.values.cha_address_id) || 0,

        // Commodity Details
        is_hazardous: form.values.is_hazardous,
        commodity_description: form.values.commodity_description,
        marks_no: form.values.marks_no,
        cargo_details: form.values.cargo_details.map((cargo) => {
          const cargoPayload: Record<string, unknown> = {
            no_of_packages: cargo.no_of_packages || null,
            gross_weight: cargo.gross_weight || null,
            volume_weight: cargo.volume_weight || null,
            chargeable_weight: cargo.chargeable_weight || null,
            volume: cargo.volume || null,
            chargeable_volume: cargo.chargeable_volume || null,
            container_type_code: cargo.container_type_code || null,
            no_of_containers: cargo.no_of_containers || null,
          };
          if (cargo.id != null && cargo.id !== undefined) {
            cargoPayload.id =
              typeof cargo.id === "number" ? cargo.id : Number(cargo.id);
          }
          return cargoPayload;
        }),

        // Pickup Details
        pickup_location: form.values.pickup_location,
        pickup_from_code: form.values.pickup_from_code,
        pickup_address_id: form.values.pickup_address_id || "0",
        planned_pickup_date: formatDate(form.values.planned_pickup_date),
        actual_pickup_date: form.values.actual_pickup_date
          ? formatDate(form.values.actual_pickup_date)
          : null,
        transporter_code: form.values.transporter_code,
        transporter_name: form.values.transporter_name,
        transporter_email: form.values.transporter_email,

        // Delivery Details
        delivery_location: form.values.delivery_location,
        delivery_from_code: form.values.delivery_from_code,
        delivery_address_id: form.values.delivery_address_id || "0",
        planned_delivery_date: formatDate(form.values.planned_delivery_date),
        actual_delivery_date: form.values.actual_delivery_date
          ? formatDate(form.values.actual_delivery_date)
          : null,

        // Events, Documents, Trigger Updates
        document_ids: form.values.document_ids,
        events: form.values.events,
        trigger_updates: form.values.trigger_updates,

        routing_details: form.values.routingDetails.map((route) => {
          const routePayload: Record<string, unknown> = {
            move_type: route.move_type,
            from_location_code: route.from_location_code,
            to_location_code: route.to_location_code,
            etd: formatDate(route.etd),
            eta: formatDate(route.eta),
            carrier_code: route.carrier_code,
            flight_no: route.flight_no,
            status: route.status,
          };
          if (route.id != null && route.id !== undefined) {
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
            roe: parseFloat(charge.roe) || 1,
            unit: charge.unit,
            no_of_units: parseFloat(charge.no_of_units) || 0,
            sell_per_unit: parseFloat(charge.sell_per_unit) || 0,
            min_sell: parseFloat(charge.min_sell) || 0,
            cost_per_unit: parseFloat(charge.cost_per_unit) || 0,
            total_cost: parseFloat(charge.total_cost) || 0,
            total_sell: parseFloat(charge.total_sell) || 0,
          };
          // Only attach id when it was received from filter endpoint; do not send generated values
          if (charge.id != null && charge.id !== undefined) {
            chargePayload.id = typeof charge.id === "number" ? charge.id : Number(charge.id);
          }
          return chargePayload;
        }),
      };

      // Add service_type and import_to_export for import bookings
      payload.service_type = "IMPORT";
      payload.import_to_export = false;

      // Include id for edit mode (at the end, matching Export structure)
      if (isEditMode && initialData?.id) {
        payload.id =
          typeof initialData.id === "number"
            ? initialData.id
            : Number(initialData.id);
      }

      console.log("Payload:", payload);

      // Submit to API - use POST for create, PUT for edit
      let response;
      if (isEditMode && payload.id) {
        // Edit mode - use PUT API call
        response = await putAPICall(
          "customer-service-shipment/",
          payload,
          API_HEADER,
        );
        console.log("Edit Response:", response);
      } else {
        // Create mode - use POST API call
        response = await postAPICall(
          "customer-service-shipment/",
          payload,
          API_HEADER,
        );
        console.log("Create Response:", response);
      }

      // Show success notification first
      ToastNotification({
        message: isEditMode
          ? "Import shipment updated successfully!"
          : "Import shipment created successfully!",
        type: "success",
      });

      // Navigate to import shipment master page with refresh flag
      navigate("/import-shipment", {
        state: {
          refreshData: true,
          timestamp: Date.now(), // Add timestamp to ensure unique navigation
        },
      });

      // Also call onComplete if provided
      onComplete?.();
    } catch (error) {
      console.error("Error submitting form:", error);
      ToastNotification({
        message: isEditMode
          ? "Failed to update import shipment. Please try again."
          : "Failed to create import shipment. Please try again.",
        type: "error",
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
      from_location_name: "",
      to_location_name: "",
      carrier_code: "",
      carrier_name: "",
      etd: null,
      eta: null,
      flight_no: null,
      status: "",
    });
  };

  const removeRoutingDetail = (index: number) => {
    form.removeListItem("routingDetails", index);
  };

  return (
    <>
      {/* Events modal - single heading row, multiple data rows (like Rate Details) */}
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
            <Button
              variant="subtle"
              onClick={() => setEventsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitEventsModal}>Add Events</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Documents modal - single heading row, multiple data rows (like Rate Details) */}
      <Modal
        opened={documentsModalOpen}
        onClose={() => setDocumentsModalOpen(false)}
        title="Documents"
        centered
        size="xl"
        styles={{ content: { maxWidth: 640 } }}
      >
        <Stack gap="md">
          {form.values.document_modal_rows.length > 0 && (
            <Grid columns={12} gutter="sm" style={{ fontWeight: 600, color: "#105476" }}>
              <Grid.Col span={5}>
                <RequiredLabel label="Document Name" required={false} />
              </Grid.Col>
              <Grid.Col span={5}>
                <RequiredLabel label="File" required={false} />
              </Grid.Col>
              <Grid.Col span={2}>
                <RequiredLabel label="Actions" required={false} />
              </Grid.Col>
            </Grid>
          )}
          {form.values.document_modal_rows.map((row, index) => (
            <Grid key={index} columns={12} gutter="sm" align="flex-end">
              <Grid.Col span={5}>
                <FormTextInput
                  placeholder="Enter document name"
                  value={row.documentName}
                  onChange={(e) =>
                    updateDocumentRow(index, "documentName", e.target.value)
                  }
                />
              </Grid.Col>
              <Grid.Col span={5}>
                <Box>
                  <Dropzone
                    onDrop={(files: File[]) => {
                      if (files.length === 0) return;
                      const file = files[0];
                      if (file.size > MAX_FILE_SIZE) {
                        ToastNotification({
                          type: "error",
                          message: `File "${file.name}" exceeds 5MB limit`,
                        });
                        return;
                      }
                      updateDocumentRow(index, "file", file);
                      updateDocumentRow(index, "document_url", undefined);
                    }}
                    onReject={() => {
                      ToastNotification({
                        type: "error",
                        message: "File size exceeds 5MB limit",
                      });
                    }}
                    maxSize={MAX_FILE_SIZE}
                    accept={undefined}
                    multiple={false}
                    disabled={false}
                    styles={{
                      root: {
                        border: "1px solid var(--mantine-color-gray-4)",
                        borderRadius: "var(--mantine-radius-sm)",
                        backgroundColor: "var(--mantine-color-white)",
                        minHeight: "36px",
                        padding: "0",
                      },
                      inner: {
                        padding: "0",
                        minHeight: "36px",
                      },
                    }}
                  >
                    <Group
                      justify="space-between"
                      gap="xs"
                      px="sm"
                      style={{
                        minHeight: "36px",
                        pointerEvents: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        {row.file ? (
                          <>
                            <IconUpload
                              size={16}
                              color="var(--mantine-color-dimmed)"
                            />
                            <Text
                              size="sm"
                              truncate
                              style={{
                                flex: 1,
                                color: "var(--mantine-color-dark)",
                              }}
                            >
                              {row.file.name}
                            </Text>
                          </>
                        ) : row.document_url ? (
                          <>
                            <IconDownload
                              size={16}
                              color="var(--mantine-color-blue-6)"
                            />
                            <Text
                              size="sm"
                              truncate
                              style={{
                                flex: 1,
                                color: "var(--mantine-color-blue-6)",
                                cursor: "pointer",
                                textDecoration: "underline",
                                pointerEvents: "auto" as const,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (row.document_url && row.userFileName) {
                                  downloadDocumentFile(
                                    row.document_url,
                                    row.userFileName,
                                  );
                                }
                              }}
                            >
                              {row.userFileName || "Download file"}
                            </Text>
                          </>
                        ) : (
                          <>
                            <IconUpload
                              size={16}
                              color="var(--mantine-color-dimmed)"
                            />
                            <Text
                              size="sm"
                              c="dimmed"
                              truncate
                              style={{ flex: 1 }}
                            >
                              Drag and drop or click to select file
                            </Text>
                          </>
                        )}
                      </Group>
                      {(row.file || row.document_url) && (
                        <Button
                          variant="subtle"
                          color="red"
                          size="xs"
                          p={4}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateDocumentRow(index, "file", null);
                            updateDocumentRow(index, "document_url", undefined);
                          }}
                          style={{ pointerEvents: "auto" }}
                        >
                          <IconX size={14} />
                        </Button>
                      )}
                    </Group>
                  </Dropzone>
                </Box>
              </Grid.Col>
              <Grid.Col
                span={2}
                style={{ display: "flex", gap: 4, marginBottom: 4 }}
              >
                {form.values.document_modal_rows.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="lg"
                    onClick={() => removeDocumentRow(index)}
                    title="Remove row"
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                )}
                {index === form.values.document_modal_rows.length - 1 && (
                  <ActionIcon
                    variant="light"
                    color="blue"
                    size="lg"
                    onClick={addDocumentRow}
                    title="Add row"
                  >
                    <IconPlus size={18} />
                  </ActionIcon>
                )}
              </Grid.Col>
            </Grid>
          ))}
          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => setDocumentsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitDocumentsModal}
              loading={documentUploading}
            >
              Attach
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Trigger Update modal - single heading row, multiple data rows (like Rate Details) */}
      <Modal
        opened={triggerModalOpen}
        onClose={() => setTriggerModalOpen(false)}
        title="Trigger Update"
        centered
        size="xl"
        styles={{ content: { maxWidth: 640 } }}
      >
        <Stack gap="md">
          {form.values.trigger_modal_rows.length > 0 && (
            <Grid columns={12} gutter="sm" style={{ fontWeight: 600, color: "#105476" }}>
              <Grid.Col span={3}>
                <RequiredLabel label="Type" required={false} />
              </Grid.Col>
              <Grid.Col span={3}>
                <RequiredLabel label="Code" required={false} />
              </Grid.Col>
              <Grid.Col span={4}>
                <RequiredLabel label="Description" required={false} />
              </Grid.Col>
              <Grid.Col span={2}>
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
                        (item) => item.name != null && String(item.name) === name,
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
                      // Code cleared via clearable button – also clear description
                      updateTriggerRow(index, "description", "");
                    }
                  }}
                  searchable
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <FormTextInput
                  placeholder="Enter description"
                  value={row.description}
                  onChange={(e) =>
                    updateTriggerRow(index, "description", e.target.value)
                  }
                />
              </Grid.Col>
              <Grid.Col
                span={2}
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
            <Button
              variant="subtle"
              onClick={() => setTriggerModalOpen(false)}
            >
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
          <Group justify="flex-end" mb="md">
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
                      form.setFieldValue(
                        "event_modal_rows",
                        [
                          ...existing.map((e) => ({
                            eventType: e.type,
                            eventDate: e.date
                              ? new Date(e.date)
                              : null,
                          })),
                          { eventType: null, eventDate: null },
                        ],
                      );
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
                  onClick={() => {
                    const displayList = form.values.document_display_list;
                    const modalRows = displayList.map((d) => ({
                      id: d.id,
                      documentName: d.documentName,
                      file: null as File | null,
                      userFileName: d.userFileName ?? "",
                      document_url: d.document_url,
                    }));
                    form.setFieldValue("document_modal_rows", [
                      ...modalRows,
                      {
                        id: undefined,
                        documentName: "",
                        file: null,
                        userFileName: "",
                      },
                    ]);
                    setDocumentsModalOpen(true);
                  }}
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
          {/* Step 1: Import Booking */}
          {active === 0 && (
            <Box>
              <Group justify="space-between" mb="lg">
                <Text size="md" fw={600} c="#105476">
                  Import Booking
                </Text>
              </Group>
              <Grid mb="lg">
                <Grid.Col span={4}>
                  <SearchableSelect
                    label="Customer Name"
                    required
                    apiEndpoint={URL.customer}
                    placeholder="Type customer name"
                    searchFields={["customer_code", "customer_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.customer_code}
                    displayValue={form.values.customer_name}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("customer_code", value || "");
                      form.setFieldValue(
                        "customer_name",
                        selectedData?.label || "",
                      );
                    }}
                    error={form.errors.customer_code as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Dropdown
                    label="Service"
                    placeholder="Select service"
                    withAsterisk
                    searchable
                    data={["FCL", "LCL"]}
                    value={form.values.service}
                    onChange={(value) => {
                      form.setFieldValue("service", value ?? "");
                      form.setFieldValue("cargo_details", [DEFAULT_CARGO_ROW]);
                    }}
                    error={form.errors.service}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
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
                    displayValue={
                      isEditMode &&
                      form.values.origin_name &&
                      form.values.origin_code
                        ? `${form.values.origin_name} (${form.values.origin_code})`
                        : form.values.origin_name
                    }
                    onChange={(value, selectedData) => {
                      form.setFieldValue("origin_code", value || "");
                      form.setFieldValue(
                        "origin_name",
                        selectedData?.label
                          ? selectedData.label.split(" (")[0]
                          : "",
                      );
                    }}
                    error={form.errors.origin_code as string}
                    minSearchLength={2}
                    additionalParams={{ transport_mode: "SEA" }}
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
                    displayValue={
                      isEditMode &&
                      form.values.destination_name &&
                      form.values.destination_code
                        ? `${form.values.destination_name} (${form.values.destination_code})`
                        : form.values.destination_name
                    }
                    onChange={(value, selectedData) => {
                      form.setFieldValue("destination_code", value || "");
                      form.setFieldValue(
                        "destination_name",
                        selectedData?.label
                          ? selectedData.label.split(" (")[0]
                          : "",
                      );
                    }}
                    error={form.errors.destination_code as string}
                    minSearchLength={2}
                    additionalParams={{ transport_mode: "SEA" }}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Dropdown
                    label="Shipment Terms"
                    placeholder="Select shipment terms"
                    withAsterisk
                    searchable
                    data={shipmentOptions}
                    {...form.getInputProps("shipment_terms_code")}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Dropdown
                    label="Freight"
                    placeholder="Select freight"
                    withAsterisk
                    searchable
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
                          // Auto-set customer_service_name when salesperson is selected
                          if (value) {
                            const selectedSalesperson = salespersonsData.find(
                              (person) => person.value === value,
                            );
                            if (selectedSalesperson?.customer_service) {
                              form.setFieldValue(
                                "customer_service_name",
                                selectedSalesperson.customer_service,
                              );
                            }
                          }
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
                    label="House Number"
                    placeholder="Enter House Number"
                    withAsterisk
                    value={form.values.houseno}
                    onChange={(e) => {
                      form.setFieldValue("houseno", e.target.value);
                    }}
                    error={form.errors.houseno}
                  />
                </Grid.Col>
                {(form.values.service === "AIR" ||
                  form.values.service === "FCL") && (
                  <Grid.Col span={4}>
                    <Radio.Group
                      label="Direct"
                      value={form.values.is_direct ? "true" : "false"}
                      onChange={(value) =>
                        form.setFieldValue("is_direct", value === "true")
                      }
                      styles={{
                        root: { fontFamily: "Inter" },
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
                        root: { fontFamily: "Inter" },
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

              <Text size="md" fw={600} mb="md" c="#105476">
                Ocean Schedule
              </Text>
              <Grid mb="lg">
                <Grid.Col span={4}>
                  <FormTextInput
                    label="Schedule ID"
                    placeholder="Enter schedule ID"
                    {...form.getInputProps("schedule_id")}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <SearchableSelect
                    label="Carrier"
                    placeholder="Type carrier name"
                    apiEndpoint={URL.carrier}
                    searchFields={["carrier_code", "carrier_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.carrier_code),
                      label: String(item.carrier_name),
                    })}
                    value={form.values.carrier_code}
                    displayValue={form.values.carrier_name}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("carrier_code", value || "");
                      form.setFieldValue(
                        "carrier_name",
                        selectedData?.label || "",
                      );
                    }}
                    error={form.errors.carrier_code as string}
                    minSearchLength={2}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <FormTextInput
                    label="Vessel Name"
                    placeholder="Select vessel"
                    {...form.getInputProps("vessel_name")}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <FormTextInput
                    label="Voyage Number"
                    placeholder="Enter voyage number"
                    {...form.getInputProps("voyage_no")}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <SingleDateInput
                    label="ETD (Estimated Time of Departure)"
                    placeholder="YYYY-MM-DD"
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
                    value={form.values.eta ?? undefined}
                    onChange={(date) => {
                      form.setFieldValue("eta", date ?? null);
                    }}
                    error={form.errors.eta}
                  />
                </Grid.Col>
              </Grid>
              
              <Divider my="lg" />

              <Text size="md" fw={600} mb="md" c="#105476">
                Routings Details
              </Text>
              <Grid
                mb="sm"
                style={{ fontWeight: 600, color: "#105476" }}
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
                              form.setFieldValue(
                                `routingDetails.${index}.from_location_name`,
                                "",
                              );
                              form.setFieldValue(
                                `routingDetails.${index}.to_location_name`,
                                "",
                              );
                              form.setFieldValue(
                                `routingDetails.${index}.carrier_name`,
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
                          error={
                            form.errors[
                              `routingDetails.${index}.from_location_code`
                            ] as string
                          }
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
                          error={
                            form.errors[
                              `routingDetails.${index}.to_location_code`
                            ] as string
                          }
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
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <SearchableSelect
                          placeholder="Type carrier name"
                          apiEndpoint={URL.carrier}
                          searchFields={["carrier_code", "carrier_name"]}
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.carrier_code),
                            label: String(item.carrier_name),
                          })}
                          value={
                            form.values.routingDetails[index]?.carrier_code ||
                            ""
                          }
                          displayValue={
                            form.values.routingDetails[index]?.carrier_name &&
                            form.values.routingDetails[index]?.carrier_code
                              ? `${form.values.routingDetails[index].carrier_name}`
                              : undefined
                          }
                          onChange={(value, selectedData) => {
                            form.setFieldValue(
                              `routingDetails.${index}.carrier_code`,
                              value || "",
                            );
                            form.setFieldValue(
                              `routingDetails.${index}.carrier_name`,
                              selectedData?.label || "",
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
                        />
                      </Grid.Col>
                      <Grid.Col span={1.5}>
                        <FormTextInput
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
                          {...form.getInputProps(
                            `routingDetails.${index}.flight_no`,
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={1.25}>
                        <Dropdown
                          data={["Active", "Inactive", "Pending", "Completed"]}
                          placeholder="Select status"
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
              <Text size="md" fw={600} mb="lg" c="#105476">
                Party Details
              </Text>
              {/* Shipper Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Shipper Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={5}>
                  {shipperHasResults === false &&
                  shipperSearch.trim().length >= 2 ? (
                    <FormTextInput
                      label="Shipper Name"
                      placeholder="Enter shipper name"
                      value={form.values.shipper_name || shipperSearch}
                      onChange={(e) => {
                        const v = toTitleCase(e.currentTarget.value);
                        setShipperSearch(v);
                        form.setFieldValue("shipper_name", v);
                        form.setFieldValue("shipper_code", "");
                      }}
                    />
                  ) : (
                    <Select
                      label="Shipper Name"
                      placeholder="Select or search shipper"
                      searchable
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
                          form.setFieldValue("shipper_address_id", 0);
                          form.setFieldValue("shipper_email", "");
                          return;
                        }
                        const original = shipperDataRef.current[value] || {};
                        const name = String(
                          (original as Record<string, unknown>).customer_name || "",
                        );
                        const addr = (
                          (
                            ((original as Record<string, unknown>)
                              .addresses_data as Array<{ address?: string }> | undefined)?.[0]
                              ?.address ?? ""
                          ) as string
                        ).toString();
                        const email = String(
                          (original as Record<string, unknown>).customer_email || "",
                        );
                        form.setFieldValue("shipper_code", value);
                        form.setFieldValue("shipper_name", toTitleCase(name));
                        form.setFieldValue("shipper_address", toTitleCase(addr));
                        form.setFieldValue("shipper_address_id", 0);
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
                    />
                  )}
                </Grid.Col>
                <Grid.Col span={7}>
                  <FormTextInput
                    label="Shipper Address"
                    placeholder="Enter shipper address"
                    value={form.values.shipper_address}
                    onChange={(e) => {
                      const v = toTitleCase(e.currentTarget.value);
                      form.setFieldValue("shipper_address", v);
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={5}>
                  <FormTextInput
                    label="Shipper E-mail ID"
                    placeholder="Enter email address"
                    {...form.getInputProps("shipper_email")}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="md" />

              {/* Consignee Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Consignee Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={5}>
                  <SearchableSelect
                    label="Consignee Name"
                    placeholder="Type consignee name"
                    apiEndpoint={URL.consignee}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.consignee_code}
                    displayValue={consigneeDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      form.setFieldValue("consignee_code", value || "");
                      if (value && selectedData) {
                        setConsigneeDisplayName(selectedData.label);
                        form.setFieldValue("consignee_name", selectedData.label);
                      } else {
                        setConsigneeDisplayName(null);
                        form.setFieldValue("consignee_name", "");
                      }

                      // Use originalData to populate address options
                      if (
                        value &&
                        originalData &&
                        (originalData as Record<string, unknown>).addresses_data
                      ) {
                        // Create address options from addresses_data
                        const addressOptions = (
                          (originalData as Record<string, unknown>)
                            .addresses_data as Array<{
                            id: number;
                            address: string;
                          }>
                        ).map((addr: { id: number; address: string }) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));

                        setConsigneeAddressOptions(addressOptions);

                        // Reset address selection when consignee changes
                        form.setFieldValue("consignee_address_id", 0);
                      } else {
                        setConsigneeAddressOptions([]);
                        form.setFieldValue("consignee_address_id", 0);
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.consignee_code as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
                <Grid.Col span={7}>
                  <Dropdown
                    label="Consignee Address"
                    placeholder="Select consignee address"
                    // withAsterisk
                    searchable
                    data={consigneeAddressOptions}
                    value={
                      form.values.consignee_address_id != null
                        ? String(form.values.consignee_address_id)
                        : ""
                    }
                    onChange={(value) => {
                      form.setFieldValue(
                        "consignee_address_id",
                        value ? parseInt(value) : 0,
                      );
                      const opt = consigneeAddressOptions.find((o) => o.value === value);
                      form.setFieldValue("consignee_address", opt?.label ?? "");
                    }}
                    error={form.errors.consignee_address_id}
                    disabled={consigneeAddressOptions.length === 0}
                  />
                </Grid.Col>
                <Grid.Col span={5}>
                  <FormTextInput
                    label="Consignee Email Id"
                    placeholder="Enter email address"
                    {...form.getInputProps("consignee_email")}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="md" />

              {/* Forwarder Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Forwarder Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={5}>
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
                      form.setFieldValue("forwarder_code", value || "");
                      setForwarderDisplayName(selectedData?.label || null);

                      // Use originalData to populate address options
                      if (
                        value &&
                        originalData &&
                        (originalData as Record<string, unknown>).addresses_data
                      ) {
                        // Create address options from addresses_data
                        const addressOptions = (
                          (originalData as Record<string, unknown>)
                            .addresses_data as Array<{
                            id: number;
                            address: string;
                          }>
                        ).map((addr: { id: number; address: string }) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));

                        setForwarderAddressOptions(addressOptions);

                        // Reset address selection when forwarder changes
                        form.setFieldValue("forwarder_address_id", 0);
                      } else {
                        setForwarderAddressOptions([]);
                        form.setFieldValue("forwarder_address_id", 0);
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.forwarder_code as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
                <Grid.Col span={7}>
                  <Dropdown
                    label="Forwarder Address"
                    placeholder="Select forwarder address"
                    searchable
                    data={forwarderAddressOptions}
                    value={
                      form.values.forwarder_address_id
                        ? String(form.values.forwarder_address_id)
                        : ""
                    }
                    onChange={(value) => {
                      form.setFieldValue(
                        "forwarder_address_id",
                        value ? parseInt(value) : 0,
                      );
                    }}
                    error={form.errors.forwarder_address_id}
                    disabled={forwarderAddressOptions.length === 0}
                  />
                </Grid.Col>
                <Grid.Col span={5}>
                  <FormTextInput
                    label="Forwarder Email Id"
                    placeholder="Enter email address"
                    {...form.getInputProps("forwarder_email")}
                  />
                </Grid.Col>
              </Grid>

          <Divider my="md" />

          {/* Origin Agent Details */}
          <Text size="sm" fw={500} mb="sm" c="#105476">
            Origin Agent Details
          </Text>
              <Grid mb="md">
                <Grid.Col span={5}>
                  <SearchableSelect
                label="Origin Agent Name"
                placeholder="Type origin agent name"
                    apiEndpoint={URL.agent}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.destination_agent_code}
                    displayValue={destinationAgentDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      form.setFieldValue("destination_agent_code", value || "");
                      setDestinationAgentDisplayName(
                        selectedData?.label || null,
                      );

                      // Use originalData to populate address options
                      if (
                        value &&
                        originalData &&
                        (originalData as Record<string, unknown>).addresses_data
                      ) {
                        // Create address options from addresses_data
                        const addressOptions = (
                          (originalData as Record<string, unknown>)
                            .addresses_data as Array<{
                            id: number;
                            address: string;
                          }>
                        ).map((addr: { id: number; address: string }) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));

                        setAgentAddressOptions(addressOptions);

                        // Reset address selection when destination agent changes
                        form.setFieldValue("destination_agent_address_id", 0);
                      } else {
                        setAgentAddressOptions([]);
                        form.setFieldValue("destination_agent_address_id", 0);
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.destination_agent_code as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
            <Grid.Col span={7}>
              <Dropdown
                label="Origin Agent Address"
                placeholder="Select destination agent address"
                    // withAsterisk
                    searchable
                    data={agentAddressOptions}
                    value={
                      form.values.destination_agent_address_id
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
            <Grid.Col span={5}>
              <FormTextInput
                label="Origin Agent Email Id"
                placeholder="Enter email address"
                    {...form.getInputProps("destination_agent_email")}
                  />
                </Grid.Col>
              </Grid>

              <Divider mb="md" />

              {/* Billing Customer Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Billing Customer Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={5}>
                  <SearchableSelect
                    label="Billing Customer Name"
                    placeholder="Type billing customer name"
                    apiEndpoint={URL.customer}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.billing_customer_code}
                    displayValue={billingCustomerDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      form.setFieldValue("billing_customer_code", value || "");
                      setBillingCustomerDisplayName(
                        selectedData?.label || null,
                      );

                      // Use originalData to populate address options
                      if (
                        value &&
                        originalData &&
                        (originalData as Record<string, unknown>).addresses_data
                      ) {
                        // Create address options from addresses_data
                        const addressOptions = (
                          (originalData as Record<string, unknown>)
                            .addresses_data as Array<{
                            id: number;
                            address: string;
                          }>
                        ).map((addr: { id: number; address: string }) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));

                        setBillingCustomerAddressOptions(addressOptions);

                        // Reset address selection when billing customer changes
                        form.setFieldValue("billing_customer_address_id", 0);
                      } else {
                        setBillingCustomerAddressOptions([]);
                        form.setFieldValue("billing_customer_address_id", 0);
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.billing_customer_code as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
                <Grid.Col span={7}>
                  <Dropdown
                    label="Billing Customer Address"
                    placeholder="Select billing customer address"
                    // withAsterisk
                    searchable
                    data={billingCustomerAddressOptions}
                    value={
                      form.values.billing_customer_address_id
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

              {/* Notify Customer Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                Notify Customer Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={5}>
                  <SearchableSelect
                    label="Notify Customer Name"
                    placeholder="Type notify customer name"
                    apiEndpoint={URL.customer}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.notify_customer_code}
                    displayValue={notifyCustomerDisplayName}
                    onChange={(value, selectedData, originalData) => {
                      form.setFieldValue("notify_customer_code", value || "");
                      setNotifyCustomerDisplayName(selectedData?.label || null);

                      // Use originalData to populate address options
                      if (
                        value &&
                        originalData &&
                        (originalData as Record<string, unknown>).addresses_data
                      ) {
                        // Create address options from addresses_data
                        const addressOptions = (
                          (originalData as Record<string, unknown>)
                            .addresses_data as Array<{
                            id: number;
                            address: string;
                          }>
                        ).map((addr: { id: number; address: string }) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));

                        setNotifyCustomerAddressOptions(addressOptions);

                        // Reset address selection when notify customer changes
                        form.setFieldValue("notify_customer_address_id", 0);
                      } else {
                        setNotifyCustomerAddressOptions([]);
                        form.setFieldValue("notify_customer_address_id", 0);
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.notify_customer_code as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
                <Grid.Col span={7}>
                  <Dropdown
                    label="Notify Customer Address"
                    placeholder="Select notify customer address"
                    searchable
                    data={notifyCustomerAddressOptions}
                    value={
                      form.values.notify_customer_address_id
                        ? String(form.values.notify_customer_address_id)
                        : ""
                    }
                    onChange={(value) => {
                      form.setFieldValue(
                        "notify_customer_address_id",
                        value ? parseInt(value) : 0,
                      );
                    }}
                    error={form.errors.notify_customer_address_id}
                    disabled={notifyCustomerAddressOptions.length === 0}
                  />
                </Grid.Col>
                <Grid.Col span={5}>
                  <FormTextInput
                    label="Notify Customer Email Id"
                    placeholder="Enter email address"
                    {...form.getInputProps("notify_customer_email")}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="md" />

              {/* CHA Details */}
              <Text size="sm" fw={500} mb="sm" c="#105476">
                CHA Details
              </Text>
              <Grid mb="md">
                <Grid.Col span={5}>
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
                      form.setFieldValue("cha_code", value || "");
                      setChaDisplayName(selectedData?.label || null);

                      // Use originalData to populate address options
                      if (
                        value &&
                        originalData &&
                        (originalData as Record<string, unknown>).addresses_data
                      ) {
                        // Create address options from addresses_data
                        const addressOptions = (
                          (originalData as Record<string, unknown>)
                            .addresses_data as Array<{
                            id: number;
                            address: string;
                          }>
                        ).map((addr: { id: number; address: string }) => ({
                          value: String(addr.id),
                          label: addr.address,
                        }));

                        setChaAddressOptions(addressOptions);

                        // Reset address selection when CHA changes
                        form.setFieldValue("cha_address_id", 0);
                      } else {
                        setChaAddressOptions([]);
                        form.setFieldValue("cha_address_id", 0);
                      }
                    }}
                    returnOriginalData={true}
                    error={form.errors.cha_code as string}
                    minSearchLength={3}
                  />
                </Grid.Col>
                <Grid.Col span={7}>
                  <Dropdown
                    label="CHA Address"
                    placeholder="Select CHA address"
                    searchable
                    data={chaAddressOptions}
                    value={
                      form.values.cha_address_id
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
              <Text size="md" fw={600} mb="lg" c="#105476">
                Cargo Details
              </Text>

              {/* Common Fields */}
              <Grid mb="xl">
                <Grid.Col span={12}>
                  <FormTextArea
                    label="Commodity Description"
                    placeholder="Enter commodity description"
                    minRows={3}
                    maxRows={6}
                    value={form.values.commodity_description}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.currentTarget.value);
                      form.setFieldValue(
                        "commodity_description",
                        formattedValue,
                      );
                    }}
                    error={form.errors.commodity_description}
                    styles={{
                      input: {
                        fontSize: "13px",
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
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <FormTextInput
                    label="Marks No"
                    placeholder="Enter marks and numbers"
                    {...form.getInputProps("marks_no")}
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
                      root: { fontFamily: "Inter" },
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
                    Cargo Details for {form.values.service}
                  </Text>

                  {/* AIR Service Cargo Details - Single Fields */}
                  {form.values.service === "AIR" && (
                    <Grid>
                      <Grid.Col span={3}>
                        <FormNumberInput
                          label="No of Packages"
                          placeholder="Enter number of packages"
                          min={1}
                          {...form.getInputProps(
                            "cargo_details.0.no_of_packages",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <FormNumberInput
                          label="Gross Weight (kg)"
                          placeholder="Enter gross weight"
                          min={0}
                          decimalScale={2}
                          {...form.getInputProps(
                            "cargo_details.0.gross_weight",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <FormNumberInput
                          label="Volume Weight (kg)"
                          placeholder="Enter volume weight"
                          min={0}
                          decimalScale={2}
                          {...form.getInputProps(
                            "cargo_details.0.volume_weight",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <FormNumberInput
                          label="Chargeable Weight (kg)"
                          // placeholder="Auto-calculated"
                          min={0}
                          decimalScale={2}
                          readOnly
                          {...form.getInputProps(
                            "cargo_details.0.chargeable_weight",
                          )}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                              backgroundColor: "#f5f5f5",
                              cursor: "not-allowed",
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
                        />
                      </Grid.Col>
                    </Grid>
                  )}

                  {/* LCL Service Cargo Details - Single Fields */}
                  {form.values.service === "LCL" && (
                    <Grid>
                      <Grid.Col span={3}>
                        <FormNumberInput
                          label="No of Packages"
                          placeholder="Enter number of packages"
                          min={1}
                          {...form.getInputProps(
                            "cargo_details.0.no_of_packages",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <FormNumberInput
                          label="Gross Weight (kg)"
                          placeholder="Enter gross weight"
                          min={0}
                          decimalScale={2}
                          {...form.getInputProps(
                            "cargo_details.0.gross_weight",
                          )}
                        />
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <FormNumberInput
                          label="Volume (cbm)"
                          placeholder="Enter volume"
                          min={0}
                          decimalScale={2}
                          {...form.getInputProps("cargo_details.0.volume")}
                        />
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <FormNumberInput
                          label="Chargeable Volume (cbm)"
                          placeholder="Auto-calculated"
                          min={0}
                          decimalScale={2}
                          readOnly
                          {...form.getInputProps(
                            "cargo_details.0.chargeable_volume",
                          )}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                              backgroundColor: "#f5f5f5",
                              cursor: "not-allowed",
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
                        />
                      </Grid.Col>
                    </Grid>
                  )}

                  {/* FCL Service Cargo Details */}
                  {form.values.service === "FCL" && (
                    <>
                      <Grid
                        mb="sm"
                        style={{
                          fontWeight: 600,
                          color: "#105476",
                        }}
                        gutter="sm"
                      >
                        <Grid.Col span={3}>
                          <RequiredLabel
                            label="Container Type"
                            required={false}
                          />
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <RequiredLabel
                            label="No of Containers"
                            required={false}
                          />
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <RequiredLabel
                            label="Gross Weight"
                            required={false}
                          />
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <RequiredLabel label="Actions" required={false} />
                        </Grid.Col>
                      </Grid>
                      <Stack gap="md">
                        {form.values.cargo_details.map((_, cargoIndex) => (
                          <Box key={cargoIndex}>
                            <Grid gutter={"sm"}>
                              <Grid.Col span={3}>
                                <Dropdown
                                  placeholder="Select container type"
                                  searchable
                                  data={containerTypeOptions}
                                  nothingFoundMessage="No container types found"
                                  {...form.getInputProps(
                                    `cargo_details.${cargoIndex}.container_type_code`,
                                  )}
                                />
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <FormNumberInput
                                  placeholder="Enter number of containers"
                                  min={1}
                                  {...form.getInputProps(
                                    `cargo_details.${cargoIndex}.no_of_containers`,
                                  )}
                                />
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <FormNumberInput
                                  placeholder="Enter gross weight"
                                  min={0}
                                  decimalScale={2}
                                  {...form.getInputProps(
                                    `cargo_details.${cargoIndex}.gross_weight`,
                                  )}
                                />
                              </Grid.Col>
                              {/* Add/Remove buttons */}
                              <Grid.Col span={3}>
                                {cargoIndex ===
                                  form.values.cargo_details.length - 1 && (
                                  <Button
                                    variant="light"
                                    color="#105476"
                                    size="sm"
                                    px={12}
                                    onClick={() => {
                                      form.insertListItem("cargo_details", {
                                        no_of_packages: undefined,
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
                                    size="sm"
                                    px={12}
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
                    </>
                  )}
                </>
              )}

              {/* Show message when no service is selected */}
              {/* {!form.values.service && (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                Please select a service type in Step 1 to see cargo details form
              </Text>
            )} */}
            </Box>
          )}

          {/* Step 4: Pickup/Delivery */}
          {active === 3 && (
            <Box>
              {/* Pickup Details Section */}
              <Text size="md" fw={600} mb="lg" c="#105476">
                Pickup/Delivery Details
              </Text>
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
                      setPickupFromDisplayName(selectedData?.label || null);
                    }}
                    error={form.errors.pickup_from_code as string}
                    minSearchLength={2}
                  />
                </Grid.Col>

                {/* Row 2: Pickup Address & Planned Pickup Date */}
                <Grid.Col span={12}>
                  <SearchableSelect
                    label="Pickup Address"
                    placeholder="Type customer name"
                    apiEndpoint={URL.customer}
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
                    value={form.values.pickup_address_id}
                    displayValue={pickupAddressDisplayName}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("pickup_address_id", value || "");
                      setPickupAddressDisplayName(selectedData?.label || null);
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
                        date || new Date(),
                      );
                    }}
                    error={form.errors.planned_pickup_date}
                  />
                </Grid.Col>

                {/* Row 3: Actual Pickup Date, Transporter Name, Transporter Email */}
                <Grid.Col span={3}>
                  <SingleDateInput
                    label="Actual Pickup Date"
                    placeholder="YYYY-MM-DD"
                    value={form.values.actual_pickup_date}
                    onChange={(date) => {
                      form.setFieldValue(
                        "actual_pickup_date",
                        date,
                      );
                    }}
                    error={form.errors.actual_pickup_date}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <SearchableSelect
                    label="Transporter Name"
                    placeholder="Type transporter / customer name"
                    apiEndpoint={URL.customer}
                    searchFields={["customer_code", "customer_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.customer_code),
                      label: String(item.customer_name),
                    })}
                    value={form.values.transporter_code}
                    displayValue={form.values.transporter_name}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("transporter_code", value || "");
                      form.setFieldValue("transporter_name", selectedData?.label || "");
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
                    {...form.getInputProps("transporter_email")}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="md" />
              
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
                      setDeliveryFromDisplayName(selectedData?.label || null);
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
                    apiEndpoint={URL.customer}
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
                    value={form.values.delivery_address_id}
                    displayValue={deliveryAddressDisplayName}
                    onChange={(value, selectedData) => {
                      form.setFieldValue("delivery_address_id", value || "");
                      setDeliveryAddressDisplayName(
                        selectedData?.label || null,
                      );
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
                        date || new Date(),
                      );
                    }}
                    error={form.errors.planned_delivery_date}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <SingleDateInput
                    label="Actual Delivery Date"
                    placeholder="YYYY-MM-DD"
                    value={form.values.actual_delivery_date}
                    onChange={(date) => {
                      form.setFieldValue(
                        "actual_delivery_date",
                        date,
                      );
                    }}
                    error={form.errors.actual_delivery_date}
                  />
                </Grid.Col>
              </Grid>
            </Box>
          )}

          {/* Step 5: Rate Details */}
          {active === 4 && (
            <Box>
              <Text size="md" fw={600} mb="md" c="#105476">
                Rate Details
              </Text>

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
                                charge_id: charge.charge_id != null ? String(charge.charge_id) : "",
                                charge_name: String(charge.charge_name || ""),
                                pp_cc: charge.pp_cc
                                  ? String(charge.pp_cc)
                                  : "Collect",
                                currency_country_code: String(
                                  charge.currency || charge.currency_country_code || "",
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
                            setCharges(mappedCharges);
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
                      <RequiredLabel label="Prepaid/Collect" required={false} />
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
                      <RequiredLabel label={`Total Sell (${defaultCurrency})`} required={false} />
                    </Grid.Col>
                    <Grid.Col span={1.05}>
                      <RequiredLabel label={`Total Cost (${defaultCurrency})`} required={false} />
                    </Grid.Col>
                    <Grid.Col span={1.1}>
                      <RequiredLabel label="Actions" required={false} />
                    </Grid.Col>
                  </Grid>
                )}
                {/* Dynamic Charge Rows */}
                {charges.map((charge, index) => (
                  <Box key={index}>
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
                          onChange={(val, selectedItem) => {
                            setCharges((prev) =>
                              prev.map((c, i) =>
                                i === index
                                  ? {
                                      ...c,
                                      charge_id: val ?? "",
                                      charge_name: val ? (selectedItem?.label ?? "") : "",
                                    }
                                  : c
                              )
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
                            updateCharge(index, "currency_country_code", value || "")
                          }
                          data={currencyOptions}
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={0.8}>
                        <FormTextInput
                          placeholder="ROE"
                          value={charge.roe}
                          onChange={(event) =>
                            updateCharge(index, "roe", event.currentTarget.value)
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <Dropdown
                          placeholder="Select Unit"
                          searchable
                          value={charge.unit}
                          onChange={(value) =>
                            updateCharge(index, "unit", value || "")
                          }
                          data={unitOptions}
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={0.8}>
                        <FormTextInput
                          placeholder="0"
                          value={charge.no_of_units}
                          onChange={(event) =>
                            updateCharge(index, "no_of_units", event.currentTarget.value)
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormTextInput
                          placeholder="0.00"
                          value={charge.sell_per_unit}
                          onChange={(event) =>
                            updateCharge(index, "sell_per_unit", event.currentTarget.value)
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormTextInput
                          placeholder="0.00"
                          value={charge.min_sell}
                          onChange={(event) =>
                            updateCharge(index, "min_sell", event.currentTarget.value)
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormTextInput
                          placeholder="0.00"
                          value={charge.cost_per_unit}
                          onChange={(event) =>
                            updateCharge(index, "cost_per_unit", event.currentTarget.value)
                          }
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          value={charge.total_sell || ""}
                          decimalScale={2}
                          readOnly
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1}>
                        <FormNumberInput
                          value={charge.total_cost || ""}
                          decimalScale={2}
                          readOnly
                          size="xs"
                        />
                      </Grid.Col>
                      <Grid.Col span={1.1}>
                        <Group gap="xs">
                          {index === charges.length - 1 && (
                            <Button
                              radius="sm"
                              size="sm"
                              px={12}
                              variant="light"
                              color="#105476"
                              onClick={addNewCharge}
                            >
                              <IconPlus size={16} />
                            </Button>
                          )}
                          {charges.length > 1 && (
                            <Button
                              variant="light"
                              color="red"
                              size="sm"
                              px={12}
                              onClick={() => removeCharge(index)}
                            >
                              <IconTrash size={16} />
                            </Button>
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
                    {charges
                      .reduce((sum, charge) => {
                        const totalSell = parseFloat(charge.total_sell) || 0;
                        return sum + totalSell;
                      }, 0)
                      .toFixed(2)}
                  </Text>
                </Grid.Col>
                <Grid.Col span={1}>
                  <Text size="sm" fw={600} mb="md" c="#105476">
                    {charges
                      .reduce((sum, charge) => {
                        const totalCost = parseFloat(charge.total_cost) || 0;
                        return sum + totalCost;
                      }, 0)
                      .toFixed(2)}
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
            onClick={() => navigate("../")}
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
        <Button
          rightSection={
            active === 4 &&
            (isSubmitting ? <Loader size={16} /> : <IconCheck size={16} />)
          }
          onClick={handleNext}
          color="#105476"
          disabled={active === 4 && isSubmitting}
        >
          {active === 4
            ? isSubmitting
              ? isEditMode
                ? "Updating booking..."
                : "Creating booking..."
              : "Submit"
            : "Next"}
        </Button>
      </Box>
    </>
  );
};

export default OceanImportBookingStepper;
