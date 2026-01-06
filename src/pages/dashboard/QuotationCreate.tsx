import {
  Box,
  Group,
  Grid,
  SegmentedControl,
  TextInput,
  Textarea,
  NumberInput,
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
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import dayjs from "dayjs";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { postAPICall } from "../../service/postApiCall";
import { putAPICall } from "../../service/putApiCall";
import { toTitleCase } from "../../utils/textFormatter";
import {
  ToastNotification,
  ServiceDetailsSlider,
  Dropdown,
} from "../../components";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../store/authStore";

const QUOTATION_APPROVAL_PATH = "/quotation-approval";
const QUOTATION_MASTER_PATH = "/quotation";

const quotationFormSchema = (isRemarkRequired: boolean) =>
  Yup.object().shape({
    quote_currency_country_code: Yup.string().required("Currency is required"),
    valid_upto: Yup.string().required("Valid upto date is required"),
    multi_carrier: Yup.string().required("Carrier type is required"),
    quote_type: Yup.string().required("Quote type is required"),
    carrier_code: Yup.string(),
    icd: Yup.string(),
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
            originalValue === "" ? null : value
          ),
        sell_per_unit: Yup.number()
          .typeError("Sell per unit is required")
          .required("Sell/unit required"),
        min_sell: Yup.number()
          .typeError("Must be a number")
          .nullable()
          .transform((value, originalValue) =>
            originalValue === "" ? null : value
          ),
        cost_per_unit: Yup.number()
          .typeError("Must be a number")
          .nullable()
          .transform((value, originalValue) =>
            originalValue === "" ? null : value
          ),
        // min_cost: Yup.number()
        //   .typeError("Must be a number")
        //   .nullable()
        //   .transform((value, originalValue) =>
        //     originalValue === "" ? null : value
        //   ),
      })
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
  icd: string;
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

const INPUT_CONTAINER_MAX_HEIGHT = 360;

function QuotationCreate({
  enquiryData,
  goToStep,
  quotationDataFromChatbot,
}: QuotationCreateProps) {
  const user = useAuthStore((state) => state.user);
  const isManagerOrAdmin = Boolean(user?.is_manager || user?.is_staff);
  const queryClient = useQueryClient();
  const [chargesData, setCharges] = useState<ChargesDataItem[]>([]);

  // Helper function to calculate ROE based on user's country and currency
  const getRoeValue = useCallback(
    (currency: string): number => {
      const userCountryCode = user?.country?.country_code;
      const currencyUpper = currency?.toUpperCase();

      if (userCountryCode === "IN") {
        // India user
        if (currencyUpper === "INR") return 1;
        if (currencyUpper === "USD") return 88.75;
      } else if (userCountryCode === "AE") {
        // Dubai/UAE user
        if (currencyUpper === "AED") return 1;
        if (currencyUpper === "USD") return 3.67;
      }

      // Default fallback
      return 1;
    },
    [user?.country?.country_code]
  );
  const [icdData, setIcdData] = useState<any[]>([]);
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
  console.log("location value-----", location);
  console.log("quotationId from params-----", quotationId);

  // Handle both scenarios: component usage and standalone route
  const quotationData = location.state;
  const actualEnquiryData =
    enquiryData || quotationData || fetchedQuotationData;
  const isRemarkRequired =
    actualEnquiryData?.actionType === "edit" ||
    actualEnquiryData?.actionType === "editQuotation";

  console.log("Whole enquiry data---", actualEnquiryData);

  // Check if this is edit mode (standalone route with quotation data)
  // Include quotationId check to handle navigation from dashboard
  const isStandaloneEdit =
    !enquiryData &&
    (quotationData || fetchedQuotationData || !!quotationId) &&
    (quotationData?.actionType === "edit" ||
      !!fetchedQuotationData ||
      !!quotationId);
  const isEmbeddedEditMode = Boolean(
    enquiryData && enquiryData.actionType === "editQuotation"
  );
  const isEditMode = isStandaloneEdit || isEmbeddedEditMode;
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
      icd: "",
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
          currency_country_code: "",
          roe: 1,
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
        (carrier: any) => carrier.label === quotationData.carrier
      );
      const carrierCode = matchedCarrier?.value || "";

      // Find currency code by matching currency name
      const data = currencyData as any[];
      const matchedCurrency = Array.isArray(data)
        ? data.find(
            (currency: any) =>
              currency.name === quotationData.quote_currency ||
              currency.code === quotationData.quote_currency
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
        icd: quotationData.icd || "",
        status: "QUOTE CREATED", // Always set to default for consistency
        remark: quotationData.remark || "",
      });

      // Set dynamic form charges
      if (quotationData.charges && quotationData.charges.length > 0) {
        const formattedCharges = quotationData.charges.map((charge: any) => ({
          charge_name: charge.charge_name || "",
          currency_country_code: charge.currency || "",
          roe: charge.roe != null ? String(charge.roe) : "1",
          unit: charge.unit || "",
          no_of_units:
            charge.no_of_units != null ? String(charge.no_of_units) : "",
          sell_per_unit:
            charge.sell_per_unit != null ? String(charge.sell_per_unit) : "",
          min_sell: charge.min_sell != null ? String(charge.min_sell) : "",
          cost_per_unit:
            charge.cost_per_unit != null ? String(charge.cost_per_unit) : "",
          total_cost:
            charge.total_cost != null ? String(charge.total_cost) : "",
          total_sell:
            charge.total_sell != null ? String(charge.total_sell) : "",
        }));

        dynamicForm.setValues({ charges: formattedCharges });
      } else {
        resetFormsToDefaults();
      }
    },
    [quotationForm, dynamicForm]
  );

  // Helper function to reset forms to defaults
  const resetFormsToDefaults = useCallback(() => {
    // Leave currency empty - useEffect will set it based on user's country when quoteCurrency is available
    quotationForm.setValues({
      quote_currency_country_code: "",
      valid_upto: "",
      multi_carrier: "false",
      quote_type: "Standard",
      carrier_code: "",
      icd: "",
      status: "QUOTE CREATED",
      remark: "",
    });
    dynamicForm.setValues({
      charges: [
        {
          charge_name: "",
          currency_country_code: "",
          roe: 1,
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
  }, [quotationForm, dynamicForm]);

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
    ]
  );

  // Effect to ensure form isolation when switching services
  useEffect(() => {
    // Force form reset when service changes to prevent data bleeding
    if (selectedService) {
      const savedData = serviceQuotationData[selectedService.id];
      if (!savedData) {
        // If no saved data, ensure forms are completely reset
        quotationForm.setValues({
          quote_currency_country_code: "",
          valid_upto: "",
          multi_carrier: "false",
          quote_type: "Standard",
          carrier_code: "",
          icd: "",
          status: "QUOTE CREATED",
          remark: "",
        });
        dynamicForm.setValues({
          charges: [
            {
              charge_name: "",
              currency_country_code: "",
              roe: 1,
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
  }, [selectedServiceIndex, selectedService?.id]);

  useEffect(() => {
    const fetchIcdData = async () => {
      // const response = await getAPICall(URL.ICD_MASTER);
      const response = [
        {
          label: "Tumb",
          value: "Tumb",
        },
      ];
      setIcdData(response);
    };
    fetchIcdData();
  }, []);

  // Fetch quotation details when quotationId is provided from URL
  useEffect(() => {
    const fetchQuotationDetails = async () => {
      if (quotationId) {
        setIsLoadingQuotationData(true);
        try {
          const response = (await getAPICall(
            `${URL.quotation}${quotationId}/`,
            API_HEADER
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
              origin_list: quotationData.origin_list,
              destination_list: quotationData.destination_list,
              quote_type_list: quotationData.quote_type_list,
              remark_list: quotationData.remark_list,
              valid_upto_list: quotationData.valid_upto_list,
              quotation: quotationData.quotation,
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
                icd: quotation.icd || "",
                status: quotationData.status || "QUOTE CREATED",
                remark: quotation.remark || "",
              };

              // Map charges data
              const mappedCharges =
                quotation.charges?.map((charge: any) => ({
                  charge_name: charge.charge_name || "",
                  currency_country_code: charge.currency || "",
                  roe: charge.roe != null ? String(charge.roe) : "1",
                  unit: charge.unit || "",
                  no_of_units:
                    charge.no_of_units != null
                      ? String(charge.no_of_units)
                      : "",
                  sell_per_unit:
                    charge.sell_per_unit != null
                      ? String(charge.sell_per_unit)
                      : "",
                  min_sell:
                    charge.min_sell != null ? String(charge.min_sell) : "",
                  cost_per_unit:
                    charge.cost_per_unit != null
                      ? String(charge.cost_per_unit)
                      : "",
                  min_cost:
                    charge.min_cost != null ? String(charge.min_cost) : "",
                  total_sell:
                    charge.total_sell != null ? String(charge.total_sell) : "",
                  total_cost:
                    charge.total_cost != null ? String(charge.total_cost) : "",
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
          quotation.carrier_name?.trim().toLowerCase()
      );
      console.log("matchedCarrier----", matchedCarrier);

      const carrierCode = matchedCarrier?.value || "";
      console.log("qwdqwfwqf----", carrierCode);

      console.log("quoteCurrency----", quoteCurrency);
      const matchedQuote = quoteCurrency.find(
        (quote: any) =>
          quote.label.trim().toLowerCase() ===
          quotation.quote_currency?.trim().toLowerCase()
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
          currency_country_code: charge.currency || "",
          roe: Number(charge.roe) || 1,
          unit: charge.unit || "",
          no_of_units: charge.no_of_units?.toString() || "",
          sell_per_unit: charge.sell_per_unit?.toString() ?? "",
          min_sell: charge.min_sell?.toString() ?? "",
          cost_per_unit: charge.cost_per_unit?.toString() ?? "",
          total_cost:
            charge.no_of_units && charge.cost_per_unit
              ? (
                  Number(charge.no_of_units) * Number(charge.cost_per_unit)
                ).toFixed(2)
              : "",
          total_sell:
            charge.no_of_units && charge.sell_per_unit
              ? (
                  Number(charge.no_of_units) * Number(charge.sell_per_unit)
                ).toFixed(2)
              : "",
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
            dynamicForm.values
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
        "Charges from location state detected, using those instead of chargesData"
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

        // Use helper function to calculate ROE based on currency and user's country
        const roe = getRoeValue(charge.currency ?? "");

        const unit = charge.unit ?? "";
        // Calculate no_of_units based on service and unit (not from API response)
        const calculatedNoOfUnits =
          unit && selectedService && !isEditMode
            ? calculateNoOfUnits(
                selectedService.service,
                unit,
                selectedService.id
              )
            : "";

        return {
          charge_name: charge.charge_name ?? "",
          currency_country_code: charge.currency ?? "",
          roe: roe,
          unit: unit,
          no_of_units: calculatedNoOfUnits,

          // ✅ Based on service
          sell_per_unit: isLCL ? rate.toString() : "",
          cost_per_unit: isLCL ? "" : rate.toString(),

          min_sell: "",

          total_cost: "",
          total_sell: "",
          toBeDisabled: false,
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
                currency_country_code: "",
                roe: 0,
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
      mappedCharges.length > 0 ? mappedCharges : []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargesData, location.state, selectedService, isEditMode]);

  useEffect(() => {
    const updatedCharges = dynamicForm.values.charges.map((charge) => {
      const noOfUnits = Number(charge.no_of_units) || 0;
      const sellPerUnit = Number(charge.sell_per_unit) || 0;
      const costPerUnit = Number(charge.cost_per_unit) || 0;
      // const minSell = Number(charge.min_sell) || 0;
      // const minCost = Number(charge.min_cost) || 0;

      // Use the ROE value from the form (user can manually change it)
      const roe = Number(charge.roe) || 1;

      // Calculate totals with ROE applied
      const calculatedSell = noOfUnits * sellPerUnit * roe;
      const calculatedCost = noOfUnits * costPerUnit * roe;

      return {
        ...charge,
        total_sell: calculatedSell.toFixed(2),
        total_cost: calculatedCost.toFixed(2),
      };
    });

    // Only update if there are changes to avoid infinite loops
    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.total_sell !== dynamicForm.values.charges[index]?.total_sell ||
        charge.total_cost !== dynamicForm.values.charges[index]?.total_cost
    );

    if (hasChanges) {
      dynamicForm.setValues({ charges: updatedCharges });
    }
  }, [
    dynamicForm.values.charges.map((c) => c.sell_per_unit).join(","),
    dynamicForm.values.charges.map((c) => c.cost_per_unit).join(","),
    dynamicForm.values.charges.map((c) => c.no_of_units).join(","),
    dynamicForm.values.charges.map((c) => c.roe).join(","),
    dynamicForm.values.charges.map((c) => c.currency_country_code).join(","),
    getRoeValue,
    // dynamicForm.values.charges.map((c) => c.min_sell).join(","),
    // dynamicForm.values.charges.map((c) => c.min_cost).join(","),
  ]);

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
        "=== QuotationCreate received data from destination page ==="
      );
      console.log("Location state data:", location.state);

      const quotationData = location.state.quotationData;

      // Set carrier code
      quotationForm.setFieldValue(
        "carrier_code",
        quotationData.carrier_code || ""
      );
      quotationForm.setFieldValue("quote_type", "Standard");

      console.log("Charges from destination:", quotationData.charges);
      console.log(
        "No of containers from destination:",
        quotationData.no_of_containers
      );

      if (quotationData.charges && Array.isArray(quotationData.charges)) {
        // Map charges from destination API response format to form format
        const mappedCharges = quotationData.charges.map((charge: any) => {
          const noOfContainers =
            quotationData.no_of_containers?.toString() || "1";
          const rate = charge.rate?.toString() || "0";

          const mappedCharge = {
            charge_name: charge.charge_name || "",
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
            dynamicForm.values.charges
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
        "=== QuotationCreate received quotation data from location state ==="
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
        quotationData.carrier_code || ""
      );
      quotationForm.setFieldValue(
        "quote_type",
        quotationData.quote_type || "Standard"
      );

      console.log("Charges from quotation data:", quotationData.charges);

      if (quotationData.charges && Array.isArray(quotationData.charges)) {
        // Get service type from quotation data
        const serviceType = quotationData.service || "FCL";
        console.log(
          "Service type for charges mapping in first useEffect:",
          serviceType
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
          "No charges found in quotation data or charges is not an array"
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
        "=== Populating dynamic form with charges from location state ==="
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
          currency_country_code: charge.currency_country_code || "INR",
          roe: charge.roe != null ? charge.roe : 1.0,
          unit: charge.unit || "",
          no_of_units: charge.no_of_units != null ? charge.no_of_units : "1",
          // sell_per_unit: isLCL ? rate.toString() : charge.sell_per_unit || "0",
          sell_per_unit: isLCL
            ? charge.sell_per_unit != null
              ? charge.sell_per_unit
              : ""
            : "",
          min_sell: charge.min_sell != null ? charge.min_sell : null,
          // cost_per_unit: isLCL ? charge.cost_per_unit || "0" : rate.toString(),
          cost_per_unit: isLCL
            ? ""
            : charge.sell_per_unit != null
              ? charge.sell_per_unit
              : "",
          total_cost: charge.total_cost != null ? charge.total_cost : "0",
          total_sell: charge.total_sell != null ? charge.total_sell : "0",
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

  const handleChatbotQuotationData = (quotationData: any) => {
    if (!quotationData) {
      console.log("No quotation data provided");
      return;
    }

    // Set form values from chatbot data
    quotationForm.setFieldValue(
      "carrier_code",
      quotationData.carrier_code || ""
    );
    quotationForm.setFieldValue(
      "quote_type",
      quotationData.quote_type || "Standard"
    );
    quotationForm.setFieldValue(
      "quote_currency_country_code",
      quotationData.quote_currency_country_code || "INR"
    );
    quotationForm.setFieldValue(
      "valid_upto",
      quotationData.valid_upto ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
    );
    quotationForm.setFieldValue(
      "multi_carrier",
      quotationData.multi_carrier ? "true" : "false"
    );
    quotationForm.setFieldValue(
      "status",
      quotationData.status || "QUOTE CREATED"
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

    // Check if this is from destination flow - only validate mandatory fields
    if (
      location.state?.fromDestination &&
      location.state?.actionType === "createQuote"
    ) {
      setIsSubmittingQuotation(true);
      console.log("Validating mandatory fields for destination flow...");
      console.log("Current enquiryData:", enquiryData);

      // Check mandatory enquiry details from the merged enquiryData prop
      const hasCustomer = enquiryData?.customer_code;
      const hasSalesPerson = enquiryData?.sales_person;
      const hasEnquiryDate = enquiryData?.enquiry_received_date;

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
        // Navigate to stepper 1 (customer details)
        if (goToStep) {
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
            valid_upto: "Valid Upto Date",
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
      if (!enquiryData?.enquiry_id && !enquiryData?.id) {
        console.log("Creating enquiry first for destination flow...");

        try {
          // Get services from enquiryData
          const services =
            enquiryData?.services || location.state?.services || [];

          console.log("Services data before mapping:", services);

          // Prepare enquiry payload in the correct format
          const enquiryPayload = {
            customer_code: enquiryData?.customer_code,
            enquiry_received_date: enquiryData?.enquiry_received_date,
            sales_person: enquiryData?.sales_person,
            sales_coordinator: enquiryData?.sales_coordinator || null,
            customer_services: enquiryData?.customer_services || null,
            services: services.map((serviceDetail: any) => {
              console.log("Processing service detail:", serviceDetail);
              console.log("FCL details:", serviceDetail.fcl_details);
              console.log("Cargo details:", serviceDetail.cargo_details);
              const servicePayload: any = {
                service: serviceDetail.service,
                trade: serviceDetail.trade || "Export",
                origin_code:
                  serviceDetail.origin_code || serviceDetail.origin_code_read,
                destination_code:
                  serviceDetail.destination_code ||
                  serviceDetail.destination_code_read,
                pickup:
                  serviceDetail.pickup === "true" ||
                  serviceDetail.pickup === true,
                delivery:
                  serviceDetail.delivery === "true" ||
                  serviceDetail.delivery === true,
                pickup_location: serviceDetail.pickup_location || "",
                delivery_location: serviceDetail.delivery_location || "",
                hazardous_cargo:
                  serviceDetail.hazardous_cargo === "Yes" ||
                  serviceDetail.hazardous_cargo === true,
                shipment_terms_code:
                  serviceDetail.shipment_terms_code ||
                  serviceDetail.shipment_terms_code_read ||
                  "",
              };

              // Add service-specific cargo details
              if (serviceDetail.service === "FCL") {
                // Check for both fcl_details and cargo_details
                const fclData =
                  serviceDetail.fcl_details || serviceDetail.cargo_details;

                console.log("FCL Data found:", fclData);

                if (fclData && Array.isArray(fclData)) {
                  servicePayload.fcl_details = fclData.map((cargo: any) => ({
                    container_type:
                      cargo.container_type || cargo.container_type_code,
                    no_of_containers: Number(cargo.no_of_containers) || 0,
                    gross_weight: cargo.gross_weight
                      ? Number(cargo.gross_weight).toFixed(2)
                      : "0.00",
                  }));
                  console.log(
                    "Mapped FCL details:",
                    servicePayload.fcl_details
                  );
                } else {
                  console.log("⚠️ No FCL data found for FCL service!");
                }
              } else if (
                serviceDetail.service === "AIR" &&
                serviceDetail.cargo_details
              ) {
                const cargo = serviceDetail.cargo_details[0];
                servicePayload.no_of_packages =
                  Number(cargo.no_of_packages) || 0;
                servicePayload.gross_weight = cargo.gross_weight
                  ? Number(cargo.gross_weight).toFixed(2)
                  : "0.00";
                servicePayload.volume_weight = cargo.volume_weight
                  ? Number(cargo.volume_weight).toFixed(2)
                  : "0.00";
                servicePayload.chargeable_weight = cargo.chargable_weight
                  ? Number(cargo.chargable_weight).toFixed(2)
                  : "0.00";
              } else if (
                serviceDetail.service === "LCL" &&
                serviceDetail.cargo_details
              ) {
                const cargo = serviceDetail.cargo_details[0];
                servicePayload.no_of_packages =
                  Number(cargo.no_of_packages) || 0;
                servicePayload.gross_weight = cargo.gross_weight
                  ? Number(cargo.gross_weight).toFixed(2)
                  : "0.00";
                servicePayload.volume = cargo.volume
                  ? Number(cargo.volume).toFixed(1)
                  : "0.0";
                servicePayload.chargeable_volume = cargo.chargable_volume
                  ? Number(cargo.chargable_volume).toFixed(1)
                  : "0.0";
              }

              console.log("Final service payload:", servicePayload);
              return servicePayload;
            }),
          };

          console.log(
            "Complete enquiry payload:",
            JSON.stringify(enquiryPayload, null, 2)
          );

          // Create enquiry
          const enquiryResponse = (await postAPICall(
            URL.enquiry,
            enquiryPayload,
            API_HEADER
          )) as {
            enquiry_id?: string;
            id?: number;
            services?: Array<{
              id: number;
              service: string;
              [key: string]: any;
            }>;
          };

          console.log("Enquiry created successfully:", enquiryResponse);

          if (!enquiryResponse || !enquiryResponse.enquiry_id) {
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

          ToastNotification({
            type: "success",
            message: "Enquiry created successfully. Now creating quotation...",
          });

          // Update actualEnquiryData with the new enquiry_id and service details
          (actualEnquiryData as any).enquiry_id = enquiryResponse.enquiry_id;
          (actualEnquiryData as any).id = enquiryResponse.id;

          // Update services with the new service IDs from the response
          if (
            enquiryResponse.services &&
            Array.isArray(enquiryResponse.services)
          ) {
            (actualEnquiryData as any).services = enquiryResponse.services;
            console.log(
              "Updated services with new IDs:",
              enquiryResponse.services
            );
          }

          console.log("Updated enquiry data with ID:", actualEnquiryData);

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
      (q: any) => q.service_id === selectedService.id
    );

    if (!quotationForService) {
      ToastNotification({
        type: "warning",
        message: "No quotation data found for selected service",
      });
      return;
    }

    // Prepare the data to pass to shipment stepper
    const bookingData = {
      // Enquiry data (common for all services)
      enquiryData: {
        enquiry_id: actualEnquiryData.enquiry_id,
        customer_name: actualEnquiryData.customer_name,
        sales_person: actualEnquiryData.sales_person,
        enquiry_received_date: actualEnquiryData.enquiry_received_date,
        // Add customer_code when available in future
        customer_code: actualEnquiryData.customer_code || "",
      },
      // Selected service quotation data
      quotationData: quotationForService,
      // Service details
      serviceDetails: selectedService,
    };

    console.log("Creating booking with data:", bookingData);

    // Navigate based on service trade
    if (selectedService.trade === "Export") {
      navigate("/customer-service/export-shipment/create", {
        state: { bookingData },
      });
    } else if (selectedService.trade === "Import") {
      navigate("/customer-service/import-shipment/create", {
        state: { bookingData },
      });
    } else {
      ToastNotification({
        type: "error",
        message: "Invalid service trade type",
      });
    }
  };

  const submitQuotation = async () => {
    // Calculate totals from charges
    const charges = dynamicForm.values.charges || [];
    const netCost = charges.reduce((sum, item) => {
      const cost = parseFloat(item.total_cost || "0");
      return sum + (isNaN(cost) ? 0 : cost);
    }, 0);

    const netSell = charges.reduce((sum, item) => {
      const sell = parseFloat(item.total_sell || "0");
      return sum + (isNaN(sell) ? 0 : sell);
    }, 0);
    const profit = netSell - netCost;

    // Transform charges to new format
    const transformedCharges = charges.map((charge: any) => {
      const base: any = {
        charge_name: charge.charge_name,
        currency_country_code: charge.currency_country_code,
        roe: parseFloat(charge.roe.toString()) || 1.0,
        unit: charge.unit,
        no_of_units: parseInt(charge.no_of_units) || 0,
        sell_per_unit: parseFloat(charge.sell_per_unit) || 0.0,
        min_sell: parseFloat(charge.min_sell) || 0.0,
        cost_per_unit: parseFloat(charge.cost_per_unit) || 0.0,
        total_sell: parseFloat(charge.total_sell ?? "0") || 0.0,
        total_cost: parseFloat(charge.total_cost ?? "0") || 0.0,
        // min_cost: parseFloat(charge.min_cost) || 0.0,
      };
      // Include the quotation charge id only for existing charges
      if (charge.id !== undefined && charge.id !== null) base.id = charge.id;
      return base;
    });

    // Get the correct service_id - use from enquiry response if available, otherwise current
    let serviceId = currentServiceId;

    // For destination flow, get service_id from the enquiry response
    if (
      location.state?.fromDestination &&
      location.state?.actionType === "createQuote"
    ) {
      // Find the service_id from the enquiry response services
      const enquiryServices = actualEnquiryData?.services || [];
      if (enquiryServices.length > 0) {
        // For destination flow, we typically have only one service
        serviceId = enquiryServices[0]?.id || currentServiceId;
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
      (condition) => condition.trim() !== ""
    );

    // Create service data for current service
    const serviceData = {
      service_id: serviceId,
      carrier_code: quotationForm.values.carrier_code,
      icd: quotationForm.values.icd,
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
        const serviceNetCost = serviceCharges.reduce(
          (sum: number, item: any) => {
            const cost = parseFloat(item.total_cost || "0");
            return sum + (isNaN(cost) ? 0 : cost);
          },
          0
        );
        const serviceNetSell = serviceCharges.reduce(
          (sum: number, item: any) => {
            const sell = parseFloat(item.total_sell || "0");
            return sum + (isNaN(sell) ? 0 : sell);
          },
          0
        );
        const serviceProfit = serviceNetSell - serviceNetCost;

        // For destination flow, use the service_id from enquiry response
        let finalServiceId = parseInt(originalServiceId);
        if (
          location.state?.fromDestination &&
          location.state?.actionType === "createQuote"
        ) {
          const enquiryServices = actualEnquiryData?.services || [];
          if (enquiryServices.length > 0) {
            finalServiceId =
              enquiryServices[0]?.id || parseInt(originalServiceId);
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
              (note) => note.trim() !== ""
            );
            serviceConditions = fetchedData.conditions.filter(
              (condition) => condition.trim() !== ""
            );
          }
        }

        return {
          service_id: finalServiceId,
          carrier_code: data.quotationForm.carrier_code,
          icd: data.quotationForm.icd,
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
              currency_country_code: charge.currency_country_code,
              roe: parseFloat(charge.roe.toString()) || 1.0,
              unit: charge.unit,
              no_of_units: parseInt(charge.no_of_units) || 0,
              sell_per_unit: parseFloat(charge.sell_per_unit) || 0.0,
              min_sell: parseFloat(charge.min_sell) || 0.0,
              cost_per_unit: parseFloat(charge.cost_per_unit) || 0.0,
              total_sell: parseFloat(charge.total_sell ?? "0") || 0.0,
              total_cost: parseFloat(charge.total_cost ?? "0") || 0.0,
              // min_cost: parseFloat(charge.min_cost) || 0.0,
            };
            // Include the quotation charge id when present (existing charge)
            if (charge.id !== undefined && charge.id !== null)
              base.id = charge.id;
            return base;
          }),
          notes: serviceNotes,
          conditions: serviceConditions,
        };
      }
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
            message: "Quotation is successfully created.",
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
      })
    );
  }, [carrierRes]);

  // Get user's currency code by matching user country_code with currency country_code
  const userCurrencyCode = useMemo(() => {
    if (!user?.country?.country_code || !Array.isArray(currencyData)) {
      return null;
    }
    const match = currencyData.find(
      (item: any) =>
        item.country_code &&
        item.country_code.toUpperCase() ===
          user.country.country_code.toUpperCase()
    );
    return match ? match.code : null;
  }, [user?.country?.country_code, currencyData]);

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
        (currency) => currency.country_code === user.country.country_code
      );

      if (matchingCurrency) {
        // console.log(
        //   `Auto-setting currency to ${matchingCurrency.value} for country ${user.country.country_code} and service ${selectedService.id}`
        // );
        quotationForm.setFieldValue(
          "quote_currency_country_code",
          matchingCurrency.value
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
            (q: any) => q.service_id === newService.id
          );

          if (quotationForService) {
            // Load quotation data for this service
            loadQuotationDataForService(
              quotationForService,
              carrierData,
              currencyData
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
    ]
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
        }
      );

      if (Object.keys(normalizedState).length === 0) {
        return;
      }

      setServiceQuotationData(normalizedState);

      const serviceWithData =
        services.find(
          (service) => service?.id && normalizedState[service.id]
        ) || services[0];

      if (serviceWithData && normalizedState[serviceWithData.id]) {
        quotationForm.setValues({
          ...normalizedState[serviceWithData.id].quotationForm,
        });
        dynamicForm.setValues({
          charges: normalizedState[serviceWithData.id].dynamicForm.charges.map(
            (charge: any) => ({ ...charge })
          ),
        });

        const serviceIndex = services.findIndex(
          (service) => service.id === serviceWithData.id
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

  // Initialize form data for edit mode
  useEffect(() => {
    // Get quotation data from either quotationData (standalone) or actualEnquiryData (from stepper)
    const quotationDataToUse =
      quotationData?.quotation ||
      actualEnquiryData?.quotation ||
      fetchedQuotationData?.quotation;
    const hasQuotationData =
      quotationDataToUse &&
      Array.isArray(quotationDataToUse) &&
      quotationDataToUse.length > 0;

    if (
      (isEditMode || hasQuotationData) &&
      (quotationData ||
        actualEnquiryData?.quotation ||
        fetchedQuotationData?.quotation) &&
      carrierData.length > 0 &&
      Array.isArray(currencyData) &&
      currencyData.length > 0 &&
      services.length > 0
    ) {
      const dataSource =
        quotationData || actualEnquiryData || fetchedQuotationData;
      console.log("Initializing form for edit mode:", dataSource);

      // Initialize service quotation data for all services
      const initialServiceData: { [serviceId: number]: any } = {};

      services.forEach((service) => {
        const quotationForService = quotationDataToUse?.find(
          (q: any) => q.service_id === service.id
        );

        if (quotationForService) {
          // Find carrier code by matching carrier name
          const matchedCarrier = carrierData.find(
            (carrier: any) => carrier.label === quotationForService.carrier
          );
          const carrierCode = matchedCarrier?.value || "";

          // Find currency code by matching currency name
          const data = currencyData as any[];
          const matchedCurrency = Array.isArray(data)
            ? data.find(
                (currency: any) =>
                  currency.name === quotationForService.quote_currency ||
                  currency.code === quotationForService.quote_currency
              )
            : null;
          const currencyCode =
            matchedCurrency?.code || quotationForService.quote_currency || "";

          // Prepare form data for this service
          const quotationForm = {
            quote_currency_country_code: currencyCode,
            valid_upto: quotationForService.valid_upto || "",
            multi_carrier: quotationForService.multi_carrier ? "true" : "false",
            quote_type: quotationForService.quote_type || "Standard",
            carrier_code: carrierCode,
            icd: quotationForService.icd || "",
            status: "QUOTE CREATED", // Always set to default for consistency
            remark: quotationForService.remark || "",
          };

          // Prepare charges data for this service
          const charges =
            quotationForService.charges &&
            quotationForService.charges.length > 0
              ? quotationForService.charges.map((charge: any) => ({
                  charge_name: charge.charge_name || "",
                  currency_country_code: charge.currency || "",
                  roe: charge.roe != null ? String(charge.roe) : "1",
                  unit: charge.unit || "",
                  no_of_units:
                    charge.no_of_units != null
                      ? String(charge.no_of_units)
                      : "",
                  sell_per_unit:
                    charge.sell_per_unit != null
                      ? String(charge.sell_per_unit)
                      : "",
                  min_sell:
                    charge.min_sell != null ? String(charge.min_sell) : "",
                  cost_per_unit:
                    charge.cost_per_unit != null
                      ? String(charge.cost_per_unit)
                      : "",
                  total_cost:
                    charge.total_cost != null ? String(charge.total_cost) : "",
                  total_sell:
                    charge.total_sell != null ? String(charge.total_sell) : "",
                  // preserve charge line id from API
                  id:
                    charge.id ?? charge.charge_id ?? charge.quotation_charge_id,
                }))
              : [
                  {
                    charge_name: "",
                    currency_country_code: "",
                    roe: 1,
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
    quotationForm.values.icd,
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
    Icd: any,
    serviceId: any
  ) {
    try {
      const payload = {
        enquiry_id: enquiryID,
        service: service,
        carrier_code: service === "LCL" ? "" : carrierVal, // For LCL, carrier is not required
        name: destinationOption,
        icd: Icd,
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
      const payload = {
        enquiry_id: actualEnquiryData.enquiry_id,
        service: selectedService?.service,
        icd: quotationForm.values.icd || "",
        service_id: currentServiceId, // Add service_id to payload
      };

      const response = await postAPICall(
        URL.carrierComparison,
        payload,
        API_HEADER
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
        API_HEADER
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
      (q: any) => q.service_id === selectedService.id
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
        API_HEADER
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
        (q: any) => q.service_id === selectedService.id
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
            : [""]
        );
        setConditions(
          Array.isArray(quotationForService.conditions) &&
            quotationForService.conditions.length > 0
            ? quotationForService.conditions
            : [""]
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
      (condition) => condition.trim() !== ""
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

  // Helper function to calculate no_of_units based on service, unit, and enquiry data
  const calculateNoOfUnits = useCallback(
    (service: string, unit: string, serviceId?: number): string => {
      // Skip if in edit mode
      if (isEditMode) {
        return "";
      }

      if (!actualEnquiryData?.services || !service || !unit) {
        return "";
      }

      // Find the service from enquiry data
      const enquiryService = serviceId
        ? actualEnquiryData.services.find((s: any) => s.id === serviceId)
        : selectedService || actualEnquiryData.services[0];

      if (!enquiryService) {
        return "";
      }

      const serviceType = enquiryService.service;
      const unitUpper = unit.toUpperCase();

      // AIR service logic
      if (serviceType === "AIR") {
        if (unitUpper === "KG") {
          // Get chargable_weight from cargo_details
          const cargo = enquiryService.cargo_details?.[0];
          return cargo?.chargable_weight || cargo?.chargeable_weight || "";
        } else if (
          unitUpper === "SHIPMENT" ||
          unitUpper === "SHPT" ||
          unitUpper === "DOC"
        ) {
          return "1";
        }
      }

      // LCL service logic
      if (serviceType === "LCL") {
        const cargo = enquiryService.cargo_details?.[0];
        if (unitUpper === "W/M") {
          return cargo?.chargable_volume || cargo?.chargeable_volume || "";
        } else if (unitUpper === "CBM") {
          return cargo?.volume || "";
        } else if (unitUpper === "SHPT" || unitUpper === "DOC") {
          return "1";
        }
      }

      // FCL service logic
      if (serviceType === "FCL") {
        // Check if unit matches shipment
        if (
          unitUpper === "SHIPMENT" ||
          unitUpper === "SHPT" ||
          unitUpper === "DOC"
        ) {
          return "1";
        }

        // Find matching container_type_code in cargo_details
        const cargoDetails =
          enquiryService.cargo_details || enquiryService.fcl_details || [];
        const matchingCargo = cargoDetails.find(
          (cargo: any) =>
            (cargo.container_type_code || "").toUpperCase() === unitUpper ||
            (cargo.container_type || "").toUpperCase() === unitUpper
        );

        if (matchingCargo) {
          return matchingCargo.no_of_containers?.toString() || "";
        }
      }

      return "";
    },
    [actualEnquiryData, selectedService, isEditMode]
  );

  // Fetch unit data based on service type
  const fetchUnitData = useCallback(
    async (serviceType: string) => {
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
          API_HEADER
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
            // Get cargo_details - check multiple sources
            let cargoDetails: any[] | null = null;

            // First, try to get from actualEnquiryData.services (create mode from enquiry)
            if (actualEnquiryData?.services) {
              const fclServiceFromEnquiry = actualEnquiryData.services.find(
                (service: any) => service.service === "FCL"
              );
              if (
                fclServiceFromEnquiry?.cargo_details &&
                Array.isArray(fclServiceFromEnquiry.cargo_details)
              ) {
                cargoDetails = fclServiceFromEnquiry.cargo_details;
              }
            }

            // If not found, try selectedService.fcl_details (edit mode from quotation)
            if (
              !cargoDetails &&
              selectedService?.fcl_details &&
              Array.isArray(selectedService.fcl_details)
            ) {
              cargoDetails = selectedService.fcl_details;
            }

            // If still not found, try selectedService.cargo_details (fallback)
            if (
              !cargoDetails &&
              selectedService?.cargo_details &&
              Array.isArray(selectedService.cargo_details)
            ) {
              cargoDetails = selectedService.cargo_details;
            }

            // Get distinct container_type_code from cargo_details
            const containerTypeCodes: string[] = [];
            if (cargoDetails && cargoDetails.length > 0) {
              const codes = [
                ...new Set(
                  cargoDetails
                    .map(
                      (cargo: any) =>
                        cargo.container_type_code || cargo.container_type
                    )
                    .filter(
                      (code: string) =>
                        code !== null && code !== undefined && code !== ""
                    )
                ),
              ];
              containerTypeCodes.push(...codes);
            }

            console.log(
              "Container type codes from enquiry:",
              containerTypeCodes
            );

            // Filter unit master response to include:
            // 1. All units where service_type === "ALL"
            // 2. The "shipment" unit (unit_code === "shipment") - usually in ALL but keeping for safety
            // 3. Units where unit_code matches any container_type_code from cargo_details
            filteredData = response.data.filter((item: any) => {
              return (
                item.service_type === "ALL" ||
                item.unit_code === "shipment" ||
                containerTypeCodes.includes(item.unit_code)
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
    },
    [actualEnquiryData, selectedService]
  );

  // Fetch unit data when selected service changes
  useEffect(() => {
    if (selectedService?.service) {
      fetchUnitData(selectedService.service);
    }
  }, [selectedService, fetchUnitData]);

  // Fetch default charges for create mode only - per selected service
  useEffect(() => {
    const fetchDefaultCharges = async () => {
      // Only fetch for create mode (not edit mode)
      if (isEditMode) {
        console.log("Edit mode detected, skipping default charges fetch");
        return;
      }

      // Check if we have the necessary data
      if (!selectedService || !actualEnquiryData) {
        console.log("No selected service or enquiry data found");
        return;
      }

      // Check if service data has required fields
      if (!selectedService.trade || !selectedService.id) {
        console.log("Service data incomplete", selectedService);
        return;
      }

      // Don't fetch if service already has saved quotation data with meaningful charges
      const savedData = serviceQuotationData[selectedService.id];
      if (savedData && savedData.dynamicForm.charges.length > 0) {
        // Check if saved charges have meaningful data (at least one charge with a name)
        const hasMeaningfulCharges = savedData.dynamicForm.charges.some(
          (charge: any) =>
            charge.charge_name && charge.charge_name.trim() !== ""
        );
        if (hasMeaningfulCharges) {
          console.log("Service already has charges data, skipping fetch");
          return;
        }
      }

      // Don't fetch if current form already has meaningful charges
      const currentCharges = dynamicForm.values.charges;
      if (currentCharges.length > 0) {
        const hasMeaningfulCharges = currentCharges.some(
          (charge: any) =>
            charge.charge_name && charge.charge_name.trim() !== ""
        );
        if (hasMeaningfulCharges) {
          console.log("Form already has charges data, skipping fetch");
          return;
        }
      }

      // Build the payload
      const payload = {
        filter: {
          trade: selectedService.trade.toUpperCase(), // Convert "Import" to "IMPORT"
          enquiry_id: actualEnquiryData.id,
          service_id: selectedService.id,
        },
      };

      console.log(
        "Fetching default charges for service:",
        selectedService.id,
        "with payload:",
        payload
      );

      try {
        const response: any = await postAPICall(
          URL.quotationDefaultChargesFilter,
          payload,
          API_HEADER
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
            const currencyCode = charge.currency || "INR";
            // Calculate ROE based on currency
            const calculatedRoe = getRoeValue(currencyCode);
            const unit = charge.unit || "";

            // Calculate no_of_units based on service and unit (not from API response)
            const calculatedNoOfUnits = unit
              ? calculateNoOfUnits(
                  selectedService.service,
                  unit,
                  selectedService.id
                )
              : "";

            return {
              charge_name: charge.charge_name || "",
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

          // Set the charges in the form
          if (mappedCharges.length > 0) {
            dynamicForm.setValues({ charges: mappedCharges });
          }
        }
      } catch (error) {
        console.error("Error fetching default charges:", error);
        // Don't show error toast as this is optional functionality
      }
    };

    fetchDefaultCharges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService, actualEnquiryData, isEditMode, serviceQuotationData]);

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
        selectedService.id
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
    const icdVal = quotationForm.values.icd;

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
              currentServiceId
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
                tempSelectedCarrier.carrier_code
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
              currentServiceId
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
                tempSelectedCarrier.carrier_code
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
              currentServiceId
            );
            console.log("Charges----", response);
            const tariffResponse = response as ChargesDataItem;
            setCharges((prev) => [...prev, tariffResponse]);

            // Update the actual selected carrier and form
            if (tempSelectedCarrier) {
              setSelectedCarrierCode(tempSelectedCarrier.carrier_code);
              quotationForm.setFieldValue(
                "carrier_code",
                tempSelectedCarrier.carrier_code
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
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Box
        p="xs"
        maw={1200}
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
          const shouldShowLayout = isEditMode || goToStep;
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
            gap="lg"
            align="flex-start"
            style={{ minHeight: "calc(100vh - 100px)" }}
          >
            {/* Left Pane - Stepper Titles - Show for edit mode without goToStep or when goToStep exists (embedded in EnquiryCreate) */}
            {(() => {
              const shouldShowLeftPane = (isEditMode && !goToStep) || goToStep;
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
                  minWidth: 240,
                  height: "calc(100vh - 100px)",
                  alignSelf: "stretch",
                  backgroundColor: "#FFFFFF",
                  position: "sticky",
                  top: 0,
                }}
              >
                <Stack gap="sm" style={{ height: "100%", padding: "10px" }}>
                  <Box>
                    <Text
                      size="md"
                      fw={600}
                      c="#105476"
                      mb="xs"
                      style={{
                        fontFamily: "Inter",
                        fontStyle: "medium",
                        fontSize: "16px",
                        color: "#105476",
                      }}
                    >
                      {isEditMode ? "Edit Quotation" : "Create Quotation"}
                    </Text>
                  </Box>

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
                        isStandaloneEdit
                      );
                      if (goToStep && typeof goToStep === "function") {
                        // Navigate to service details step (step 1) in enquiry-create flow
                        console.log("Calling goToStep(1)");
                        goToStep(1);
                      } else if (isEmbeddedEditMode) {
                        // If embedded but goToStep not available, navigate to enquiry-create
                        console.log(
                          "Embedded mode but goToStep missing, navigating to enquiry-create step 1"
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
              <Box
                style={{
                  flex: 1,
                  overflowY: "auto",
                  paddingBottom: "16px",
                  backgroundColor: "#F8F8F8",
                  minHeight: 0,
                }}
              >
                <Box style={{ backgroundColor: "#FFFFFF", padding: "24px" }}>
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
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
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
                        {...quotationForm.getInputProps(
                          "quote_currency_country_code"
                        )}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.75}>
                      <Box maw={300} mx="auto">
                        <DateInput
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
                            quotationForm.setFieldValue(
                              "valid_upto",
                              formatted
                            );
                          }}
                          valueFormat="YYYY-MM-DD"
                          leftSection={<IconCalendar size={18} />}
                          leftSectionPointerEvents="none"
                          radius="sm"
                          size="sm"
                          // dropdownType="popover"
                          styles={{
                            input: {
                              height: "36px",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                            label: {
                              fontSize: "13px",
                              fontWeight: 500,
                              color: "#424242",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                            day: {
                              width: "2.25rem",
                              height: "2.25rem",
                              fontSize: "0.9rem",
                            },
                            calendarHeaderLevel: {
                              fontSize: "1rem",
                              fontWeight: 500,
                              marginBottom: "0.5rem",
                              flex: 1,
                              textAlign: "center",
                            },
                            calendarHeaderControl: {
                              width: "2rem",
                              height: "2rem",
                              margin: "0 0.5rem",
                            },
                            calendarHeader: {
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.5rem",
                            },
                          }}
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
                            event.currentTarget.checked ? "true" : "false"
                          );
                        }}
                        styles={{
                          label: {
                            fontSize: "13px",
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
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
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
                        {...quotationForm.getInputProps("quote_type")}
                      />
                    </Grid.Col>
                    {selectedService?.service !== "LCL" && (
                      <Grid.Col span={1.25}>
                        <Dropdown
                          label="Carrier"
                          placeholder="Carrier"
                          searchable
                          // withAsterisk
                          data={carrierData}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
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
                          {...quotationForm.getInputProps("carrier_code")}
                        />
                      </Grid.Col>
                    )}
                    {selectedService?.service !== "LCL" && (
                      <Grid.Col span={1}>
                        <Dropdown
                          label="ICD"
                          placeholder="ICD"
                          searchable
                          // withAsterisk
                          data={icdData}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
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
                          {...quotationForm.getInputProps("icd")}
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
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
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
                        {...quotationForm.getInputProps("status")}
                      />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Flex gap="sm" align="flex-end">
                        <div style={{ flex: 1 }}>
                          <TextInput
                            label="Remark"
                            withAsterisk={isRemarkRequired}
                            placeholder="Enter remark"
                            value={quotationForm.values.remark}
                            onChange={(e) => {
                              const formattedValue = toTitleCase(
                                e.target.value
                              );
                              quotationForm.setFieldValue(
                                "remark",
                                formattedValue
                              );
                            }}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
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
                            error={quotationForm.errors.remark}
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
                        <Grid.Col span={1.5}>
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
                        <Grid.Col span={1}>
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
                        <Grid.Col span={1}>
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
                            {userCurrencyCode ? ` (${userCurrencyCode})` : ""}
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
                            {userCurrencyCode ? ` (${userCurrencyCode})` : ""}
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
                          <Grid.Col span={1.5}>
                            {/* <Select
                  label="Charge Name"
                  key={
                    dynamicForm.values.charges[index].charge_name ||
                    `unit-${index}-charge_name`
                  }
                  placeholder="Enter Charge name"
                  // data={chargesData}
                  {...dynamicForm.getInputProps(`charges.${index}.charge_name`)}
                /> */}
                            <TextInput
                              key={`charge-name-${index}`}
                              // label="Charge Name"
                              placeholder="Charge Name"
                              // data={quoteCurrency}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.charge_name`
                              )}
                            />
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
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.currency_country_code`
                              )}
                              onChange={(value) => {
                                // Set currency value
                                dynamicForm.setFieldValue(
                                  `charges.${index}.currency_country_code`,
                                  value || ""
                                );
                                // Automatically set ROE based on currency and user's country
                                if (value) {
                                  const calculatedRoe = getRoeValue(value);
                                  dynamicForm.setFieldValue(
                                    `charges.${index}.roe`,
                                    calculatedRoe
                                  );
                                }
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <TextInput
                              key={
                                // dynamicForm.values.charges[index]?.roe ||
                                `unit-${index}-roe`
                              }
                              min={1}
                              // decimalScale={2}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.roe`
                              )}
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
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.unit`
                              )}
                              onChange={(value) => {
                                // Set unit value
                                dynamicForm.setFieldValue(
                                  `charges.${index}.unit`,
                                  value || ""
                                );

                                // Auto-calculate and set no_of_units based on service and unit
                                if (value && selectedService) {
                                  const calculatedNoOfUnits =
                                    calculateNoOfUnits(
                                      selectedService.service,
                                      value,
                                      selectedService.id
                                    );
                                  if (calculatedNoOfUnits) {
                                    dynamicForm.setFieldValue(
                                      `charges.${index}.no_of_units`,
                                      calculatedNoOfUnits
                                    );
                                  }
                                }
                              }}
                              disabled={isLoadingUnitData}
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <TextInput
                              key={`unit-${index}-no_of_units`}
                              //placeholder={"100"}
                              min={1}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.no_of_units`
                              )}
                              disabled={
                                dynamicForm.values.charges[index]?.toBeDisabled
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <TextInput
                              key={
                                // dynamicForm.values.charges[index]?.sell_per_unit ||
                                `unit-${index}-sell_per_unit`
                              }
                              //placeholder={"100"}
                              min={0}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.sell_per_unit`
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <TextInput
                              key={
                                // dynamicForm.values.charges[index]?.min_sell ||
                                `unit-${index}-min_sell`
                              }
                              disabled={
                                dynamicForm.values.charges[index]?.toBeDisabled
                              }
                              min={0}
                              //placeholder={"100"}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.min_sell`
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <TextInput
                              key={
                                // dynamicForm.values.charges[index]?.cost_per_unit ||
                                `unit-${index}-cost_per_unit`
                              }
                              disabled={
                                dynamicForm.values.charges[index]?.toBeDisabled
                              }
                              //placeholder={"100"}
                              min={0}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                              }}
                              {...dynamicForm.getInputProps(
                                `charges.${index}.cost_per_unit`
                              )}
                            />
                          </Grid.Col>
                          {/* <Grid.Col span={1}>
                <TextInput
                  key={
                    dynamicForm.values.charges[index]?.min_cost ||
                    `unit-${index}-min_cost`
                  }
                  disabled={dynamicForm.values.charges[index]?.toBeDisabled}
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
                            <TextInput
                              key={`unit-${index}-total_sell`}
                              value={
                                dynamicForm.values.charges[index]?.total_sell ??
                                "0.00"
                              }
                              readOnly
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                  backgroundColor: "#f8f9fa",
                                  cursor: "not-allowed",
                                },
                              }}
                              // disabled
                            />
                          </Grid.Col>
                          <Grid.Col span={1}>
                            <TextInput
                              key={`unit-${index}-total_cost`}
                              value={
                                dynamicForm.values.charges[index]?.total_cost ??
                                "0.00"
                              }
                              readOnly
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                  backgroundColor: "#f8f9fa",
                                  cursor: "not-allowed",
                                },
                              }}
                              // disabled
                            />
                          </Grid.Col>

                          {/* </>
                )} */}

                          {dynamicForm.values.charges.length - 1 === index && (
                            <Grid.Col span={0.75}>
                              <Button
                                radius={"sm"}
                                variant="light"
                                color="#105476"
                                onClick={() =>
                                  dynamicForm.insertListItem("charges", {
                                    charge_name: "",
                                    currency_country_code: "",
                                    roe: 1,
                                    unit: "",
                                    no_of_units: "",
                                    sell_per_unit: "",
                                    min_sell: "",
                                    cost_per_unit: "",
                                    // min_cost: "",
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
                      <Grid.Col span={1}>{netSell.toFixed(2)}</Grid.Col>
                      <Grid.Col span={1}> {netCost.toFixed(2)}</Grid.Col>
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
                        Profit=
                      </Grid.Col>
                      <Grid.Col span={1}> {profit.toFixed(2)}</Grid.Col>
                    </Grid>
                  </Stack>
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
                    {/* Show Cancel and Clear all for createQuote flow */}
                    {goToStep && enquiryData?.actionType === "createQuote" && (
                      <>
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
                      </>
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
                          // Navigate back to quotation list when from pipeline report
                          navigateToPreferredList(
                            location.state?.preserveFilters
                          );
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
                            location.state?.preserveFilters
                          );
                        }
                      }}
                    >
                      Back
                    </Button>
                  </Group>
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
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
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
                      {...quotationForm.getInputProps(
                        "quote_currency_country_code"
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.75}>
                    <Box maw={300} mx="auto">
                      <DateInput
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
                        styles={{
                          input: {
                            height: "36px",
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                          label: {
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "#424242",
                            marginBottom: "4px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                          day: {
                            width: "2.25rem",
                            height: "2.25rem",
                            fontSize: "0.9rem",
                          },
                          calendarHeaderLevel: {
                            fontSize: "1rem",
                            fontWeight: 500,
                            marginBottom: "0.5rem",
                            flex: 1,
                            textAlign: "center",
                          },
                          calendarHeaderControl: {
                            width: "2rem",
                            height: "2rem",
                            margin: "0 0.5rem",
                          },
                          calendarHeader: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                          },
                        }}
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
                          event.currentTarget.checked ? "true" : "false"
                        );
                      }}
                      styles={{
                        label: {
                          fontSize: "13px",
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
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
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
                      {...quotationForm.getInputProps("quote_type")}
                    />
                  </Grid.Col>
                  {selectedService?.service !== "LCL" && (
                    <Grid.Col span={1.25}>
                      <Dropdown
                        label="Carrier"
                        placeholder="Carrier"
                        searchable
                        data={carrierData}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
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
                        {...quotationForm.getInputProps("carrier_code")}
                      />
                    </Grid.Col>
                  )}
                  {selectedService?.service !== "LCL" && (
                    <Grid.Col span={1}>
                      <Dropdown
                        label="ICD"
                        placeholder="ICD"
                        searchable
                        data={icdData}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
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
                        {...quotationForm.getInputProps("icd")}
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
                          fontSize: "13px",
                          fontFamily: "Inter",
                          height: "36px",
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
                      {...quotationForm.getInputProps("status")}
                    />
                  </Grid.Col>
                  <Grid.Col span={2}>
                    <Flex gap="sm" align="flex-end">
                      <div style={{ flex: 1 }}>
                        <TextInput
                          label="Remark"
                          withAsterisk={isRemarkRequired}
                          placeholder="Enter remark"
                          value={quotationForm.values.remark}
                          onChange={(e) => {
                            const formattedValue = toTitleCase(e.target.value);
                            quotationForm.setFieldValue(
                              "remark",
                              formattedValue
                            );
                          }}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
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
                          error={quotationForm.errors.remark}
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
                      <Grid.Col span={1.5}>
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
                      <Grid.Col span={1}>
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
                      <Grid.Col span={1}>
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
                          {userCurrencyCode ? ` (${userCurrencyCode})` : ""}
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
                          {userCurrencyCode ? ` (${userCurrencyCode})` : ""}
                        </Text>
                      </Grid.Col>
                    </Grid>
                  )}
                  {dynamicForm.values.charges.map((_, index) => (
                    <Box key={index}>
                      <Grid gutter="sm">
                        <Grid.Col span={1.5}>
                          <TextInput
                            key={`charge-name-${index}`}
                            placeholder="Charge Name"
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.charge_name`
                            )}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <Dropdown
                            placeholder="Select Currency"
                            searchable
                            key={`unit-${index}-currency_country_code`}
                            data={currency}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.currency_country_code`
                            )}
                            onChange={(value) => {
                              dynamicForm.setFieldValue(
                                `charges.${index}.currency_country_code`,
                                value || ""
                              );
                              if (value) {
                                const calculatedRoe = getRoeValue(value);
                                dynamicForm.setFieldValue(
                                  `charges.${index}.roe`,
                                  calculatedRoe
                                );
                              }
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <TextInput
                            key={`unit-${index}-roe`}
                            min={1}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.roe`
                            )}
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
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.unit`
                            )}
                            onChange={(value) => {
                              dynamicForm.setFieldValue(
                                `charges.${index}.unit`,
                                value || ""
                              );
                              if (value && selectedService) {
                                const calculatedNoOfUnits = calculateNoOfUnits(
                                  selectedService.service,
                                  value,
                                  selectedService.id
                                );
                                if (calculatedNoOfUnits) {
                                  dynamicForm.setFieldValue(
                                    `charges.${index}.no_of_units`,
                                    calculatedNoOfUnits
                                  );
                                }
                              }
                            }}
                            disabled={isLoadingUnitData}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <TextInput
                            key={`unit-${index}-no_of_units`}
                            min={1}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.no_of_units`
                            )}
                            disabled={
                              dynamicForm.values.charges[index]?.toBeDisabled
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <TextInput
                            key={`unit-${index}-sell_per_unit`}
                            min={0}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.sell_per_unit`
                            )}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <TextInput
                            key={`unit-${index}-min_sell`}
                            disabled={
                              dynamicForm.values.charges[index]?.toBeDisabled
                            }
                            min={0}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.min_sell`
                            )}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <TextInput
                            key={`unit-${index}-cost_per_unit`}
                            disabled={
                              dynamicForm.values.charges[index]?.toBeDisabled
                            }
                            min={0}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                            }}
                            {...dynamicForm.getInputProps(
                              `charges.${index}.cost_per_unit`
                            )}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <TextInput
                            key={`unit-${index}-total_sell`}
                            value={
                              dynamicForm.values.charges[index]?.total_sell ??
                              "0.00"
                            }
                            readOnly
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                                backgroundColor: "#f8f9fa",
                                cursor: "not-allowed",
                              },
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={1}>
                          <TextInput
                            key={`unit-${index}-total_cost`}
                            value={
                              dynamicForm.values.charges[index]?.total_cost ??
                              "0.00"
                            }
                            readOnly
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                                backgroundColor: "#f8f9fa",
                                cursor: "not-allowed",
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
                                  currency_country_code: "",
                                  roe: 1,
                                  unit: "",
                                  no_of_units: "",
                                  sell_per_unit: "",
                                  min_sell: "",
                                  cost_per_unit: "",
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
                    <Grid.Col span={1}>{netSell.toFixed(2)}</Grid.Col>
                    <Grid.Col span={1}> {netCost.toFixed(2)}</Grid.Col>
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
                      Profit=
                    </Grid.Col>
                    <Grid.Col span={1}> {profit.toFixed(2)}</Grid.Col>
                  </Grid>
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
                        // Navigate back to quotation list when from pipeline report
                        navigateToPreferredList(
                          location.state?.preserveFilters
                        );
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
                          location.state?.preserveFilters
                        );
                      }
                    }}
                  >
                    Back
                  </Button>
                </Group>
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
                              ₹{carrier.all_inclusive_total.toLocaleString()}
                            </Text>
                          </Stack>
                        </Card>
                      </Grid.Col>
                    );
                  }
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
                              ₹{carrier.all_inclusive_total.toLocaleString()}
                            </Text>
                          </Stack>
                        </Card>
                      </Grid.Col>
                    );
                  }
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
                        {historyItem.sell_per_unit
                          ? parseFloat(historyItem.sell_per_unit).toFixed(2)
                          : "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.min_sell
                          ? parseFloat(historyItem.min_sell).toFixed(2)
                          : "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.cost_per_unit
                          ? parseFloat(historyItem.cost_per_unit).toFixed(2)
                          : "-"}
                      </Table.Td>
                      {/* <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.min_cost
                          ? parseFloat(historyItem.min_cost).toFixed(2)
                          : "-"}
                      </Table.Td> */}
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.total_cost
                          ? parseFloat(historyItem.total_cost).toFixed(2)
                          : "-"}
                      </Table.Td>
                      <Table.Td style={{ textAlign: "center" }}>
                        {historyItem.total_sell
                          ? parseFloat(historyItem.total_sell).toFixed(2)
                          : "-"}
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
                              "DD-MM-YYYY HH:mm:ss"
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
