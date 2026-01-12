import {
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Flex,
  Grid,
  Group,
  Loader,
  Modal,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconUpload,
  IconX,
  IconUser,
  IconTruckDelivery,
  IconCircleCheck,
  IconFileText,
} from "@tabler/icons-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "@mantine/hooks";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { getAPICall } from "../../service/getApiCall";
import { DateInput } from "@mantine/dates";
import { Dropzone } from "@mantine/dropzone";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
  DateRangeInput,
} from "../../components";
import dayjs from "dayjs";
import { postAPICall } from "../../service/postApiCall";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QuotationCreate from "./QuotationCreate";
import { useDisclosure } from "@mantine/hooks";
import { apiCallProtected } from "../../api/axios";
import { toTitleCase } from "../../utils/textFormatter";
import useAuthStore from "../../store/authStore";

// Type definitions

type TermsOfShipmentData = {
  tos_code: string;
  tos_name: string;
};

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

type QuotationData = {
  id: number;
  enquiry_id: string;
  customer_name: string;
  enquiry_received_date: string;
  origin_name: string;
  destination_name: string;
  sales_person: string;
  quote_currency: string;
  valid_upto: string;
  multi_carrier: boolean;
  quote_type: string;
  carrier_name: string;
  charges: any[];
  service: string;
  created_by: string;
  created_by_name: string;
  status: string;
  status_display: string;
  remark: string;
  trade: string;
  fcl_details: any[];
  location: string | null;
  total_cost: string;
  total_sell: string;
  profit: string;
  chargeable_volume: number | null;
};

type CallEntryData = {
  id: number;
  customer_name: string;
  customer_code: string;
  call_date: string;
  call_mode: string;
  call_summary: string;
  followup_date: string;
  followup_action: string;
  salesman: string;
  expected_profit: number;
};

type JobData = {
  id: number;
  job_no: string;
  customer_name: string;
  origin_name: string;
  destination_name: string;
  revenue: number;
  profit: number;
};

type ShipmentData = {
  customer_name: string;
  carrier_name: string;
  booking_no: string;
  revenue: number;
  gp: number;
};

type PotentialProfilingData = {
  id: number;
  service: string;
  origin_port_code: string;
  origin_port_name: string;
  destination_port_code: string;
  destination_port_name: string;
  no_of_shipments: number;
  frequency_id: number;
  frequency_name: string;
  volume: number;
  tier: string;
  potential_profit: number;
};

type CustomerDataResponse = {
  customer_info: {
    customer_code: string;
    customer_name: string;
    salesperson: string | null;
    credit_day: number | null;
    total_net_balance: number;
    total_credit_amount: number | null;
    last_visited: string | null;
    overall_total_revenue?: number | null;
    overall_total_gp?: number | null;
  };
  quotations: {
    count: number;
    data: QuotationData[];
  };
  call_entries: {
    count: number;
    data: CallEntryData[];
  };
  job_profit: {
    count: number;
    data: JobData[];
  };
  shipment: {
    count: number;
    data: ShipmentData[];
    overall_total_revenue: number;
    overall_total_gp: number;
  };
  potential_profiling: {
    count: number;
    data: PotentialProfilingData[];
  };
};

// Dimension unit options array - JSON object structure
const DIMENSION_UNIT_OPTIONS = [
  {
    service: "AIR",
    unit_value: [
      { value: 6000, Label: "Centimeter" },
      { value: 366, Label: "Inch" },
    ],
  },
  {
    service: "LCL",
    unit_value: [
      { value: 1000000, Label: "Centimeter" },
      { value: 1728, Label: "Inch" },
    ],
  },
];

const customerFormSchema = yup.object({
  customer_code: yup.string().required("Customer code is required"),
  enquiry_received_date: yup
    .string()
    .required("Enquiry received date is required"),
  sales_person: yup.string().required("Sales person is required"),
  sales_coordinator: yup.string().nullable().optional(),
  customer_services: yup.string().nullable().optional(),
  reference_no: yup
    .string()
    .nullable()
    .optional()
    .max(100, "Reference number cannot exceed 100 characters"),
  customer_address: yup.string().nullable().optional(),
});

const serviceFormSchema = yup.object({
  service_details: yup
    .array()
    .of(
      yup.object({
        id: yup.string().optional(),
        service: yup
          .string()
          .required("Service is required")
          .oneOf(["AIR", "FCL", "LCL", "OTHERS"], "Select service"),
        trade: yup.string().when("service", {
          is: (service: string) => service !== "OTHERS",
          then: (schema) => schema.required("Trade is required"),
          otherwise: (schema) => schema.nullable(),
        }),
        service_code: yup.string().when("service", {
          is: "OTHERS",
          then: (schema) => schema.required("Service name is required"),
          otherwise: (schema) => schema.nullable(),
        }),
        service_name: yup.string().when("service", {
          is: "OTHERS",
          then: (schema) => schema.optional(),
          otherwise: (schema) => schema.nullable(),
        }),
        origin_code: yup.string().required("Origin is required"),
        origin_name: yup.string().optional(),
        destination_code: yup.string().required("Destination is required"),
        destination_name: yup.string().optional(),
        pickup: yup.string().oneOf(["true", "false"]),
        delivery: yup.string().oneOf(["true", "false"]),
        service_remark: yup.string().optional(),
        commodity: yup.string().optional(),
        shipment_terms_code: yup
          .string()
          .required("Shipment terms are required"),

        pickup_location: yup.string().when("pickup", {
          is: "true",
          then: (schema) => schema.required("Pickup location is required"),
          otherwise: (schema) => schema.optional(),
        }),

        delivery_location: yup.string().when("delivery", {
          is: "true",
          then: (schema) => schema.required("Delivery location is required"),
          otherwise: (schema) => schema.optional(),
        }),

        cargo_details: yup
          .array()
          .of(
            yup.object({
              no_of_packages: yup.number().when("$service", {
                is: (service: string) => service === "AIR" || service === "LCL",
                then: (schema) =>
                  schema
                    .required("Number of packages is required")
                    .min(1, "Must be at least 1"),
                otherwise: (schema) => schema.nullable(),
              }),
              gross_weight: yup.number().when("$service", {
                is: (service: string) =>
                  service === "AIR" || service === "LCL" || service === "FCL",
                then: (schema) =>
                  schema
                    .required("Gross weight is required")
                    .min(0.01, "Must be greater than 0"),
                otherwise: (schema) => schema.nullable(),
              }),
              volume_weight: yup.number().when("$service", {
                is: (service: string) => service === "AIR",
                then: (schema) =>
                  schema
                    .required("Volume weight is required")
                    .min(0.01, "Must be greater than 0"),
                otherwise: (schema) => schema.nullable(),
              }),
              chargable_weight: yup.number().nullable(),
              volume: yup.number().when("$service", {
                is: (service: string) => service === "LCL",
                then: (schema) =>
                  schema
                    .required("Volume is required")
                    .min(0.01, "Must be greater than 0"),
                otherwise: (schema) => schema.nullable(),
              }),
              chargable_volume: yup.number().nullable(),
              container_type_code: yup.string().when("$service", {
                is: (service: string) => service === "FCL",
                then: (schema) => schema.required("Container type is required"),
                otherwise: (schema) => schema.nullable(),
              }),
              no_of_containers: yup.number().when("$service", {
                is: (service: string) => service === "FCL",
                then: (schema) =>
                  schema
                    .required("Number of containers is required")
                    .min(1, "Must be at least 1"),
                otherwise: (schema) => schema.nullable(),
              }),
              hazardous_cargo: yup
                .string()
                .required("Hazardous cargo is required"),
              stackable: yup.string().required("Stackable cargo is required"),
            })
          )
          .min(1, "At least one cargo detail is required"),
      })
    )
    .min(1, "At least one service detail is required"),
});

const fetchEnquiry = async () => {
  try {
    const requestBody = { filters: { status: "ACTIVE" } };

    const response = await apiCallProtected.post(
      `${URL.enquiryFilter}`,
      requestBody
    );
    console.log("fetchEnquiry check=", response);
    return response;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};
const fetchQuotation = async () => {
  try {
    const requestBody = { filters: { status: "ACTIVE" } };
    const response = await apiCallProtected.post(
      `${URL.quotationFilter}`,
      requestBody
    );
    console.log("fetchQuotation check=", response);
    return response;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// Remove fetchPortMaster as we'll use SearchableSelect instead
// const fetchPortMaster = async () => {
//   const response = await getAPICall(`${URL.portMaster}`, API_HEADER);
//   // console.log("Porttttt response-----", response);
//   return response?.data;
// };

const fetchTermsofShipment = async () => {
  const response = await getAPICall(`${URL.termsOfShipment}`, API_HEADER);
  // console.log("fetchTermsofShipment response----", response);
  return response;
};

const fetchContainerType = async () => {
  const response = await getAPICall(`${URL.containerType}`, API_HEADER);
  console.log("containerType----", response);
  return response;
};

const fetchSalespersons = async (customerId: string = "") => {
  const payload = {
    customer_code: customerId,
  };
  console.log(
    "🔍 Fetching salespersons with payload:",
    payload,
    "URL:",
    URL.salespersons,
    "Timestamp:",
    new Date().toISOString()
  );
  const response = await postAPICall(URL.salespersons, payload, API_HEADER);
  console.log("📊 Salespersons response:", response);
  return response;
};

const fetchOtherServices = async () => {
  const response = await getAPICall(
    `${URL.serviceMaster}?filter=other_services`,
    API_HEADER
  );
  return response;
};

function EnquiryCreate() {
  const location = useLocation();
  const [enq] = useState(location.state || null);
  // Initialize active step based on targetStep from navigation or default to 0
  const [active, setActive] = useState((enq as any)?.targetStep ?? 0);
  // Initialize showQuotation based on actionType for edit quotation and create quote flows
  const [showQuotation, setShowQuotation] = useState(
    enq?.actionType === "editQuotation" || enq?.actionType === "createQuote"
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [
    documentsModalOpened,
    { open: openDocumentsModal, close: closeDocumentsModal },
  ] = useDisclosure(false);
  const [fileErrors, setFileErrors] = useState<{ [key: number]: string }>({});
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  const navigate = useNavigate();

  // Helper function to download file from URL
  const downloadFile = (url: string, fileName: string) => {
    // Simply open the document_url directly
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const queryClient = useQueryClient(); // Add this line to get query client
  const { user } = useAuthStore();

  // State for salesperson confirmation modal
  const [
    salespersonModalOpened,
    { open: openSalespersonModal, close: closeSalespersonModal },
  ] = useDisclosure(false);
  const [salespersonModalData, setSalespersonModalData] =
    useState<SalespersonData | null>(null);
  const [isCheckingSalesperson, setIsCheckingSalesperson] = useState(false);
  const [lastCheckedServiceIndex, setLastCheckedServiceIndex] = useState<
    number | null
  >(null);

  const { data: termsOfShipment = [] } = useQuery({
    queryKey: ["tosData"],
    queryFn: fetchTermsofShipment,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const shipmentOptions = useMemo(() => {
    if (!Array.isArray(termsOfShipment) || !termsOfShipment.length) return [];
    return termsOfShipment.map((item: any) => ({
      value: item.tos_code ? String(item.tos_code) : "",
      label: `${item.tos_name} (${item.tos_code})`,
    }));
  }, [termsOfShipment]);

  // Customer Form
  const customerForm = useForm({
    initialValues: {
      customer_code: "",
      enquiry_received_date: dayjs().format("YYYY-MM-DD"),
      sales_person: "",
      sales_coordinator: "",
      customer_services: "",
      reference_no: "",
      customer_address: "",
      supporting_documents: [] as Array<{
        name: string;
        file: File | null;
        document_url?: string;
        document_id?: number;
        original_document_name?: string; // Store original name to detect changes
      }>,
    },
    validate: yupResolver(customerFormSchema),
  });

  // Service Form
  const serviceForm = useForm({
    initialValues: {
      service_details: [
        {
          service: "",
          trade: "",
          service_code: "",
          service_name: "",
          origin_code: "",
          origin_name: "",
          destination_code: "",
          destination_name: "",
          pickup: "false",
          delivery: "false",
          pickup_location: "",
          delivery_location: "",
          shipment_terms_code: "",
          service_remark: "", // Added service remark field
          commodity: "", // Added commodity description field
          dimension_unit: "Centimeter",
          diemensions: [],
          cargo_details: [
            {
              id: null,
              no_of_packages: null,
              gross_weight: null,
              volume_weight: null,
              chargable_weight: null,
              volume: null,
              chargable_volume: null,
              container_type_code: null,
              no_of_containers: null,
              hazardous_cargo: "No",
              stackable: "Yes",
            },
          ],
        },
      ],
    },
    validate: yupResolver(serviceFormSchema),
  });

  // Calculate chargeable volume for LCL service
  const calculateChargeableVolume = useCallback(
    (grossWeight: number | null, volume: number | null): number => {
      if (!grossWeight && !volume) return 0;

      const grossWeightInCbm = grossWeight ? grossWeight / 1000 : 0;
      const volumeInCbm = volume || 0;

      return Math.max(grossWeightInCbm, volumeInCbm);
    },
    []
  );

  // Calculate chargeable weight for AIR service (max of gross weight and volume weight)
  const calculateChargeableWeight = useCallback(
    (grossWeight: number | null, volumeWeight: number | null): number => {
      if (!grossWeight && !volumeWeight) return 0;
      const gross = grossWeight || 0;
      const volume = volumeWeight || 0;
      return Math.max(gross, volume);
    },
    []
  );

  // Debounced function to update chargeable volume and chargeable weight - prevents excessive recalculations
  const debouncedUpdateChargeableValues = useDebouncedCallback(() => {
    serviceForm.values.service_details.forEach(
      (serviceDetail, serviceIndex) => {
        // Safety check: ensure cargo_details exists and has at least one item
        if (
          !serviceDetail.cargo_details ||
          !Array.isArray(serviceDetail.cargo_details) ||
          serviceDetail.cargo_details.length === 0
        ) {
          return; // Skip if no cargo details
        }

        const cargo = serviceDetail.cargo_details[0];
        if (!cargo) {
          return; // Skip if cargo is undefined
        }

        // Determine effective service type inline for OTHERS services
        let effectiveServiceType = serviceDetail.service;
        if (serviceDetail.service === "OTHERS" && serviceDetail.service_code) {
          // Access otherServicesData from closure (will be available when function executes)
          const selectedOtherService = (otherServicesData || []).find(
            (item: any) => item.value === serviceDetail.service_code
          );
          if (selectedOtherService) {
            const transportMode = selectedOtherService.transport_mode || "";
            const fullGroupage = selectedOtherService.full_groupage || "";
            if (transportMode === "SEA" && fullGroupage === "FULL") {
              effectiveServiceType = "FCL";
            } else if (transportMode === "SEA" && fullGroupage === "GROUPAGE") {
              effectiveServiceType = "LCL";
            } else {
              effectiveServiceType = "AIR";
            }
          }
        }

        if (effectiveServiceType === "LCL") {
          const grossWeight = Number(cargo.gross_weight) || null;
          const volume = Number(cargo.volume) || null;

          if (grossWeight || volume) {
            const chargeableVolume = calculateChargeableVolume(
              grossWeight,
              volume
            );
            const currentValue = cargo.chargable_volume;

            // Only update if the value actually changed to prevent unnecessary re-renders
            if (currentValue !== chargeableVolume) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_volume`,
                chargeableVolume
              );
            }
          } else {
            // Clear chargeable volume if both inputs are empty
            if (cargo.chargable_volume !== null) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_volume`,
                null
              );
            }
          }
          // Clear chargeable weight when service is LCL
          if (cargo && cargo.chargable_weight !== null) {
            serviceForm.setFieldValue(
              `service_details.${serviceIndex}.cargo_details.0.chargable_weight`,
              null
            );
          }
        } else if (effectiveServiceType === "AIR") {
          const grossWeight = Number(cargo.gross_weight) || null;
          const volumeWeight = Number(cargo.volume_weight) || null;

          if (grossWeight || volumeWeight) {
            const chargeableWeight = calculateChargeableWeight(
              grossWeight,
              volumeWeight
            );
            const currentValue = cargo.chargable_weight;

            // Only update if the value actually changed to prevent unnecessary re-renders
            if (currentValue !== chargeableWeight) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_weight`,
                chargeableWeight
              );
            }
          } else {
            // Clear chargeable weight if both inputs are empty
            if (cargo.chargable_weight !== null) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_weight`,
                null
              );
            }
          }
          // Clear chargeable volume when service is AIR
          if (cargo && cargo.chargable_volume !== null) {
            serviceForm.setFieldValue(
              `service_details.${serviceIndex}.cargo_details.0.chargable_volume`,
              null
            );
          }
        } else {
          // Clear chargeable values when service is neither LCL nor AIR
          if (cargo) {
            if (cargo.chargable_volume !== null) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_volume`,
                null
              );
            }
            if (cargo.chargable_weight !== null) {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.cargo_details.0.chargable_weight`,
                null
              );
            }
          }
        }
      }
    );
  }, 300);

  // Optimized effect to recalculate chargeable values when cargo inputs change
  // Track only the cargo fields that affect chargeable calculations
  const cargoValuesKey = useMemo(() => {
    return serviceForm.values.service_details
      .map((s, idx) => {
        const cargo = s.cargo_details[0];
        if (!cargo) return `${idx}:empty`;
        return `${idx}:${s.service}:${cargo.gross_weight || 0}:${cargo.volume_weight || 0}:${cargo.volume || 0}`;
      })
      .join("||");
  }, [serviceForm.values.service_details]);

  useEffect(() => {
    debouncedUpdateChargeableValues();
  }, [cargoValuesKey, debouncedUpdateChargeableValues]);

  // Dimension helper functions
  // const getDimensionValue = useCallback(
  //   (service: string, unit: string): number => {
  //     const u = (unit || "").toLowerCase();
  //     if (service === "LCL") {
  //       if (u === "inch" || u === "inches") return 1000000;
  //       if (u === "centimeter" || u === "cm" || u === "centimeters")
  //         return 0.000016387064;
  //     }
  //     if (service === "AIR") {
  //       if (u === "inch" || u === "inches") return 366.0;
  //       if (u === "centimeter" || u === "cm" || u === "centimeters")
  //         return 6000.0;
  //     }
  //     return 0;
  //   },
  //   []
  // );
  const getDimensionValue = useCallback(
    (service: string, unit: string): number => {
      if (!unit) return 0;

      const serviceOption = DIMENSION_UNIT_OPTIONS.find(
        (option) => option.service === service
      );

      if (serviceOption) {
        const unitOption = serviceOption.unit_value.find(
          (unitItem) => unitItem.Label === unit
        );
        return unitOption ? unitOption.value : 0;
      }

      return 0;
    },
    []
  );

  const roundVol = useCallback((val: number): number => {
    if (!isFinite(val)) return 0;
    const frac = val - Math.trunc(val);
    if (frac >= 0.5) return Math.ceil(val);
    return Math.round(val * 100) / 100;
  }, []);

  // Store original values before dimensions are added
  const originalValuesRef = useRef<{
    [key: string]: {
      no_of_packages: number | null;
      volume?: number | null;
      volume_weight?: number | null;
      gross_weight?: number | null;
    };
  }>({});

  // Helper to check if a service has valid dimension data
  const hasValidDimensions = useCallback((dimensions: any[]): boolean => {
    return (
      Array.isArray(dimensions) &&
      dimensions.length > 0 &&
      dimensions.some(
        (r: any) =>
          (Number(r?.pieces) || 0) > 0 && (Number(r?.vol_weight) || 0) > 0
      )
    );
  }, []);

  // Recalculate dimensions totals - optimized to prevent infinite loops
  const recalcDimensionsTotals = useCallback(() => {
    serviceForm.values.service_details.forEach(
      (serviceDetail, serviceIndex) => {
        // Determine effective service type inline for OTHERS services
        let effectiveServiceType = serviceDetail.service;
        if (serviceDetail.service === "OTHERS" && serviceDetail.service_code) {
          // Access otherServicesData from closure (will be available when function executes)
          const selectedOtherService = (otherServicesData || []).find(
            (item: any) => item.value === serviceDetail.service_code
          );
          if (selectedOtherService) {
            const transportMode = selectedOtherService.transport_mode || "";
            const fullGroupage = selectedOtherService.full_groupage || "";
            if (transportMode === "SEA" && fullGroupage === "FULL") {
              effectiveServiceType = "FCL";
            } else if (transportMode === "SEA" && fullGroupage === "GROUPAGE") {
              effectiveServiceType = "LCL";
            } else {
              effectiveServiceType = "AIR";
            }
          }
        }

        if (effectiveServiceType !== "AIR" && effectiveServiceType !== "LCL")
          return;

        const key = `${serviceIndex}-${effectiveServiceType}`;
        const rows = serviceDetail.diemensions || [];
        const cargo = serviceDetail.cargo_details[0];
        const hasValidDims = hasValidDimensions(rows);

        // If no valid dimension data exists
        if (!hasValidDims) {
          // Clear dimension_unit when dimensions array is empty
          if (!Array.isArray(rows) || rows.length === 0) {
            if (serviceDetail.dimension_unit !== "") {
              serviceForm.setFieldValue(
                `service_details.${serviceIndex}.dimension_unit`,
                ""
              );
            }
          }

          // Don't restore values or do anything else - let user manually edit
          return;
        }

        // Store original values before first dimension calculation
        if (!originalValuesRef.current[key]) {
          originalValuesRef.current[key] = {
            no_of_packages: cargo?.no_of_packages || null,
            gross_weight: cargo?.gross_weight || null,
            volume:
              effectiveServiceType === "LCL"
                ? cargo?.volume || null
                : undefined,
            volume_weight:
              effectiveServiceType === "AIR"
                ? cargo?.volume_weight || null
                : undefined,
          };
        }

        // Calculate totals from dimensions
        const totalPieces = rows.reduce(
          (sum: number, r: any) => sum + (Number(r?.pieces) || 0),
          0
        );
        const totalVolWeightRaw = rows.reduce(
          (sum: number, r: any) => sum + (Number(r?.vol_weight) || 0),
          0
        );
        const totalVolRounded = roundVol(totalVolWeightRaw);

        // Only update if values actually changed
        if (cargo.no_of_packages !== totalPieces) {
          serviceForm.setFieldValue(
            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`,
            totalPieces || null
          );
        }

        if (effectiveServiceType === "AIR") {
          if (cargo.volume_weight !== totalVolRounded) {
            serviceForm.setFieldValue(
              `service_details.${serviceIndex}.cargo_details.0.volume_weight`,
              totalVolRounded || null
            );
          }
        } else if (effectiveServiceType === "LCL") {
          if (cargo.volume !== totalVolRounded) {
            serviceForm.setFieldValue(
              `service_details.${serviceIndex}.cargo_details.0.volume`,
              totalVolRounded || null
            );
          }
        }
      }
    );
  }, [serviceForm, roundVol, hasValidDimensions]);

  // Track dimension changes with proper memoization to prevent infinite loops
  const dimensionsKey = useMemo(() => {
    return serviceForm.values.service_details
      .map((s, idx) => {
        const dims = s.diemensions || [];
        const dimsStr = dims
          .map((d: any) => `${d.pieces}-${d.length}-${d.width}-${d.height}`)
          .join("|");
        return `${idx}:${s.service}:${s.dimension_unit}:${dimsStr}`;
      })
      .join("||");
  }, [serviceForm.values.service_details]);

  useEffect(() => {
    recalcDimensionsTotals();
  }, [dimensionsKey, recalcDimensionsTotals]);

  const createEnquiry = async (values: any): Promise<void> => {
    try {
      setIsSubmitting(true);

      // Always use FormData format
      const formData = new FormData();

      // Get supporting documents
      const supportingDocuments =
        customerForm.values.supporting_documents || [];

      // Append all files with indexed keys and document names (if any files exist)
      // Keep original file name - don't rename files
      supportingDocuments.forEach((doc, index: number) => {
        if (doc.file) {
          // Use original file name
          formData.append(`documents[${index}]`, doc.file);
          formData.append(`document_names[${index}]`, doc.name || "");
        }
      });

      // Always append the enquiry data as JSON string
      formData.append("enquiry_data", JSON.stringify(values));

      // Always use apiCallProtected with FormData
      const res = await apiCallProtected.post(URL.enquiry, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...API_HEADER.headers,
        },
      });

      if (res) {
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
          message: "Enquiry is created successfully",
        });

        // Preserve filters if they were preserved when navigating here
        const preserveFilters = (location.state as any)?.preserveFilters;
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
      }
    } catch (err: any) {
      setIsSubmitting(false);
      ToastNotification({
        type: "error",
        message: `Error while creating enquiry: ${err?.message || "Unknown error"}`,
      });
    }
  };
  const editEnquiry = async (values: any): Promise<void> => {
    console.log("editEnquiry values---", values);

    try {
      setIsSubmitting(true);

      // Always use FormData format
      const formData = new FormData();

      // Get supporting documents
      const supportingDocuments =
        customerForm.values.supporting_documents || [];

      // Append all files with indexed keys and document names (if any files exist)
      // Keep original file name - don't rename files
      supportingDocuments.forEach((doc, index: number) => {
        if (doc.file) {
          // Use original file name
          formData.append(`documents[${index}]`, doc.file);
          formData.append(`document_names[${index}]`, doc.name || "");
        }
      });

      // Always append the enquiry data as JSON string
      formData.append("enquiry_data", JSON.stringify(values));

      // Always use apiCallProtected with FormData
      // Append ID to URL like putAPICall does: url + `${formValue.id}/`
      const res = await apiCallProtected.put(
        `${URL.enquiry}${values.id}/`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...API_HEADER.headers,
          },
        }
      );

      if (res) {
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
          message: "Enquiry is Updated successfully",
        });

        // Check if we came from edit quotation (fromQuotation flag)
        const fromQuotation = (location.state as any)?.fromQuotation;
        const preserveFilters = (location.state as any)?.preserveFilters;

        // Navigate to quotation list if came from edit quotation, otherwise enquiry list
        if (fromQuotation) {
          // Came from edit quotation, navigate back to quotation list
          if (preserveFilters) {
            navigate("/quotation", {
              state: {
                restoreFilters: preserveFilters,
                refreshData: true,
              },
            });
          } else {
            navigate("/quotation", { state: { refreshData: true } });
          }
        } else {
          // Default: navigate to enquiry list
          if (preserveFilters) {
            navigate("/enquiry", {
              state: {
                // restoreFilters: preserveFilters,
                refreshData: true,
              },
            });
          } else {
            navigate("/enquiry", { state: { refreshData: true } });
          }
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      ToastNotification({
        type: "error",
        message: `Error while updating enquiry: ${err?.message || "Unknown error"}`,
      });
    }
  };

  const handleFinalSubmit = () => {
    // Custom validation for cargo details based on service type
    let hasCargoErrors = false;
    serviceForm.values.service_details.forEach(
      (serviceDetail, serviceIndex) => {
        const cargo = serviceDetail.cargo_details[0];

        if (!serviceDetail.service) {
          return; // Skip if no service selected yet
        }

        // Determine effective service type for validation (for OTHERS, determine from selected service)
        let effectiveServiceType = serviceDetail.service;
        if (serviceDetail.service === "OTHERS" && serviceDetail.service_code) {
          const selectedOtherService = otherServicesData.find(
            (item) => item.value === serviceDetail.service_code
          );
          if (selectedOtherService) {
            const transportMode = selectedOtherService.transport_mode || "";
            const fullGroupage = selectedOtherService.full_groupage || "";
            if (transportMode === "SEA" && fullGroupage === "FULL") {
              effectiveServiceType = "FCL";
            } else if (transportMode === "SEA" && fullGroupage === "GROUPAGE") {
              effectiveServiceType = "LCL";
            } else {
              effectiveServiceType = "AIR";
            }
          }
        }

        if (effectiveServiceType === "AIR" || effectiveServiceType === "LCL") {
          if (!cargo?.no_of_packages || cargo.no_of_packages < 1) {
            serviceForm.setFieldError(
              `service_details.${serviceIndex}.cargo_details.0.no_of_packages`,
              "Number of packages is required"
            );
            hasCargoErrors = true;
          } else {
            serviceForm.clearFieldError(
              `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
            );
          }
        }

        if (
          effectiveServiceType === "AIR" ||
          effectiveServiceType === "LCL" ||
          effectiveServiceType === "FCL"
        ) {
          if (!cargo?.gross_weight || cargo.gross_weight < 0.01) {
            serviceForm.setFieldError(
              `service_details.${serviceIndex}.cargo_details.0.gross_weight`,
              "Gross weight is required"
            );
            hasCargoErrors = true;
          } else {
            serviceForm.clearFieldError(
              `service_details.${serviceIndex}.cargo_details.0.gross_weight`
            );
          }
        }

        if (effectiveServiceType === "AIR") {
          if (!cargo?.volume_weight || cargo.volume_weight < 0.01) {
            serviceForm.setFieldError(
              `service_details.${serviceIndex}.cargo_details.0.volume_weight`,
              "Volume weight is required"
            );
            hasCargoErrors = true;
          } else {
            serviceForm.clearFieldError(
              `service_details.${serviceIndex}.cargo_details.0.volume_weight`
            );
          }
        }

        if (effectiveServiceType === "LCL") {
          if (!cargo?.volume || cargo.volume < 0.01) {
            serviceForm.setFieldError(
              `service_details.${serviceIndex}.cargo_details.0.volume`,
              "Volume is required"
            );
            hasCargoErrors = true;
          } else {
            serviceForm.clearFieldError(
              `service_details.${serviceIndex}.cargo_details.0.volume`
            );
          }
        }

        if (effectiveServiceType === "FCL") {
          // FCL can have multiple cargo details, validate each one
          serviceDetail.cargo_details.forEach(
            (fclCargo: any, cargoIndex: number) => {
              const containerTypeCode = fclCargo?.container_type_code;
              if (
                !containerTypeCode ||
                (typeof containerTypeCode === "string" &&
                  !containerTypeCode.trim())
              ) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`,
                  "Container type is required"
                );
                hasCargoErrors = true;
              } else {
                serviceForm.clearFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`
                );
              }
              if (
                !fclCargo?.no_of_containers ||
                fclCargo.no_of_containers < 1
              ) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`,
                  "Number of containers is required"
                );
                hasCargoErrors = true;
              } else {
                serviceForm.clearFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`
                );
              }
              if (!fclCargo?.gross_weight || fclCargo.gross_weight < 0.01) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`,
                  "Gross weight is required"
                );
                hasCargoErrors = true;
              } else {
                serviceForm.clearFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`
                );
              }
            }
          );
          serviceDetail.cargo_details.forEach(
            (fclCargo: any, cargoIndex: number) => {
              const containerTypeCode = fclCargo?.container_type_code;
              if (
                !containerTypeCode ||
                (typeof containerTypeCode === "string" &&
                  !containerTypeCode.trim())
              ) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`,
                  "Container type is required"
                );
                hasCargoErrors = true;
              } else {
                serviceForm.clearFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`
                );
              }
              if (
                !fclCargo?.no_of_containers ||
                fclCargo.no_of_containers < 1
              ) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`,
                  "Number of containers is required"
                );
                hasCargoErrors = true;
              } else {
                serviceForm.clearFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`
                );
              }
              if (!fclCargo?.gross_weight || fclCargo.gross_weight < 0.01) {
                serviceForm.setFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`,
                  "Gross weight is required"
                );
                hasCargoErrors = true;
              } else {
                serviceForm.clearFieldError(
                  `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`
                );
              }
            }
          );
        }
      }
    );

    // If there are cargo validation errors, navigate to service details step and return
    if (hasCargoErrors) {
      setActive(1);
      return;
    }

    // Check for file size errors
    const hasFileErrors = Object.keys(fileErrors).length > 0;
    if (hasFileErrors) {
      ToastNotification({
        type: "error",
        message: "Please fix file size errors before submitting",
      });
      // Open the documents modal to show errors
      if (!documentsModalOpened) {
        openDocumentsModal();
      }
      return;
    }

    const cusFormResult = customerForm.validate();
    const serviceFormResult = serviceForm.validate();

    if (!cusFormResult.hasErrors && !serviceFormResult.hasErrors) {
      const isEditMode =
        enq?.actionType === "edit" || (enq?.id && enq?.quoteType !== "CHATBOT");
      // Exclude supporting_documents from baseData as it will be sent separately as files
      const { supporting_documents, ...customerFormDataWithoutFiles } =
        customerForm.values;
      const baseData = {
        ...customerFormDataWithoutFiles,
        ...(enq?.call_entry_id && { call_entry: enq.call_entry_id }),
        services: serviceForm.values.service_details.map((serviceDetail) => {
          const servicePayload: any = {
            service: serviceDetail.service,
            origin_code: serviceDetail.origin_code,
            destination_code: serviceDetail.destination_code,
            pickup: serviceDetail.pickup === "true",
            delivery: serviceDetail.delivery === "true",
            pickup_location: serviceDetail.pickup_location,
            delivery_location: serviceDetail.delivery_location,
            hazardous_cargo:
              serviceDetail.cargo_details[0]?.hazardous_cargo === "Yes",
            stackable: serviceDetail.cargo_details[0]?.stackable === "Yes",
            shipment_terms_code: serviceDetail.shipment_terms_code,
            service_remark: serviceDetail.service_remark,
            commodity: serviceDetail.commodity,
          };

          // Handle OTHERS service case
          if (serviceDetail.service === "OTHERS") {
            servicePayload.trade = null;
            servicePayload.service_name = serviceDetail.service_name || "";
            servicePayload.service_code = serviceDetail.service_code || "";
          } else {
            servicePayload.trade = serviceDetail.trade;
          }

          if (isEditMode && (serviceDetail as any).id) {
            servicePayload.id = (serviceDetail as any).id;
          }

          // Determine effective service type for cargo structure (for OTHERS, determine from selected service)
          let effectiveServiceType = serviceDetail.service;
          if (
            serviceDetail.service === "OTHERS" &&
            serviceDetail.service_code
          ) {
            const selectedOtherService = otherServicesData.find(
              (item) => item.value === serviceDetail.service_code
            );
            if (selectedOtherService) {
              const transportMode = selectedOtherService.transport_mode || "";
              const fullGroupage = selectedOtherService.full_groupage || "";
              if (transportMode === "SEA" && fullGroupage === "FULL") {
                effectiveServiceType = "FCL";
              } else if (
                transportMode === "SEA" &&
                fullGroupage === "GROUPAGE"
              ) {
                effectiveServiceType = "LCL";
              } else {
                effectiveServiceType = "AIR";
              }
            }
          }

          // Add service-specific cargo details
          if (effectiveServiceType === "FCL") {
            servicePayload.fcl_details = serviceDetail.cargo_details.map(
              (cargo) => {
                const fclDetail: any = {
                  container_type: cargo.container_type_code,
                  no_of_containers: Number(cargo.no_of_containers) || 0,
                  gross_weight: cargo.gross_weight
                    ? Number(cargo.gross_weight).toFixed(2)
                    : "0.00",
                };
                // Only include id if it exists (for existing cargo details in edit mode)
                if (cargo.id) {
                  fclDetail.id = cargo.id;
                }
                return fclDetail;
              }
            );
          } else if (effectiveServiceType === "AIR") {
            const cargo = serviceDetail.cargo_details[0];
            servicePayload.no_of_packages = Number(cargo.no_of_packages) || 0;
            servicePayload.gross_weight = cargo.gross_weight
              ? Number(cargo.gross_weight).toFixed(2)
              : "0.00";
            servicePayload.volume_weight = cargo.volume_weight
              ? Math.round(Number(cargo.volume_weight) * 1000) / 1000
              : 0;
            servicePayload.chargeable_weight = cargo.chargable_weight
              ? Number(cargo.chargable_weight).toFixed(2)
              : "0.00";
            // Include dimension_details directly in service payload if present
            const dimUnit = serviceDetail.dimension_unit || "";
            const dimRows = Array.isArray(serviceDetail.diemensions)
              ? serviceDetail.diemensions
              : [];
            if (dimUnit && dimRows.length > 0) {
              servicePayload.dimension_details = dimRows.map((r: any) => {
                const dimensionItem: any = {
                  pieces: Number(r?.pieces) || 0,
                  length: Number(r?.length) || 0,
                  width: Number(r?.width) || 0,
                  height: Number(r?.height) || 0,
                  value:
                    Number(r?.value) || getDimensionValue("AIR", dimUnit) || 0,
                  volume_weight: r?.vol_weight
                    ? Math.round(Number(r.vol_weight) * 1000) / 1000
                    : 0,
                  dimension_unit: dimUnit,
                };
                // Only include id if it exists
                if (r?.id) {
                  dimensionItem.id = r.id;
                }
                return dimensionItem;
              });
            }
          } else if (effectiveServiceType === "LCL") {
            const cargo = serviceDetail.cargo_details[0];
            servicePayload.no_of_packages = Number(cargo.no_of_packages) || 0;
            servicePayload.gross_weight = cargo.gross_weight
              ? Number(cargo.gross_weight).toFixed(2)
              : "0.00";
            servicePayload.volume = cargo.volume
              ? Number(cargo.volume).toFixed(1)
              : "0.0";
            servicePayload.chargeable_volume = cargo.chargable_volume
              ? Number(cargo.chargable_volume).toFixed(1)
              : "0.0";
            // Include dimension_details directly in service payload if present
            const dimUnit = serviceDetail.dimension_unit || "";
            const dimRows = Array.isArray(serviceDetail.diemensions)
              ? serviceDetail.diemensions
              : [];
            if (dimUnit && dimRows.length > 0) {
              servicePayload.dimension_details = dimRows.map((r: any) => {
                const dimensionItem: any = {
                  pieces: Number(r?.pieces) || 0,
                  length: Number(r?.length) || 0,
                  width: Number(r?.width) || 0,
                  height: Number(r?.height) || 0,
                  value:
                    Number(r?.value) || getDimensionValue("LCL", dimUnit) || 0,
                  volume_weight: r?.vol_weight
                    ? Math.round(Number(r.vol_weight) * 1000) / 1000
                    : 0,
                  dimension_unit: dimUnit,
                };
                // Only include id if it exists
                if (r?.id) {
                  dimensionItem.id = r.id;
                }
                return dimensionItem;
              });
            }
          }

          return servicePayload;
        }),
      };

      // Determine if this is edit mode based on actionType or if enquiry ID exists

      if (isEditMode) {
        // Collect document IDs from supporting_documents that have document_id
        // Include document_name if it has been changed from the original
        const documentsList = customerForm.values.supporting_documents
          .filter(
            (doc) => doc.document_id !== undefined && doc.document_id !== null
          )
          .map((doc) => {
            const docItem: { id: number; document_name?: string } = {
              id: doc.document_id!,
            };
            // Include document_name if it differs from the original
            if (
              doc.original_document_name !== undefined &&
              doc.name !== doc.original_document_name
            ) {
              docItem.document_name = doc.name;
            }
            return docItem;
          });

        const editData = {
          ...baseData,
          id: enq?.id,
          ...(documentsList.length > 0 && { documents_list: documentsList }),
        };
        console.log("Editing data:", editData);
        editEnquiry(editData);
      } else {
        console.log("Creating data:", baseData);
        createEnquiry(baseData);
      }
    } else {
      ToastNotification({
        type: "warning",
        message: "Fill the previous Forms",
      });
    }
  };

  // Function to check salesperson data from API
  const checkSalespersonData = async (serviceIndex: number) => {
    const customerCode = customerForm.values.customer_code;
    const serviceDetail = serviceForm.values.service_details[serviceIndex];
    const service = serviceDetail?.service;
    const trade = serviceDetail?.trade;

    // Only check if all required fields are available
    if (!customerCode || !service || !trade) {
      console.log("❌ Missing required fields:", {
        customerCode,
        service,
        trade,
        serviceIndex,
      });
      return;
    }

    // Don't check again if we already checked this service index
    if (lastCheckedServiceIndex === serviceIndex) {
      console.log("⏭️ Already checked for service index:", serviceIndex);
      return;
    }

    try {
      setIsCheckingSalesperson(true);
      console.log("🔍 Checking salesperson data:", {
        customerCode,
        service,
        trade,
        serviceIndex,
      });
      const response = (await apiCallProtected.post(URL.accountsSalespersons, {
        customer_code: customerCode,
        service: service,
        service_type: trade,
      })) as {
        success?: boolean;
        message?: string;
        data?: SalespersonData[];
      };

      if (response?.success && response?.data && response.data.length > 0) {
        const apiSalesperson = response.data[0];
        const currentSalesperson = customerForm.values.sales_person;

        // Compare sales_person from API with current selection
        if (
          apiSalesperson.sales_person &&
          currentSalesperson &&
          apiSalesperson.sales_person !== currentSalesperson
        ) {
          // Salesperson doesn't match - show modal
          setSalespersonModalData(apiSalesperson);
          openSalespersonModal();
          setLastCheckedServiceIndex(serviceIndex);
        }
      }
    } catch (error) {
      console.error("Error checking salesperson data:", error);
    } finally {
      setIsCheckingSalesperson(false);
    }
  };

  // Function to handle Yes button in modal - update form with API data
  const handleUpdateSalespersonData = () => {
    if (salespersonModalData) {
      if (salespersonModalData.sales_person) {
        customerForm.setFieldValue(
          "sales_person",
          salespersonModalData.sales_person
        );
      }
      if (salespersonModalData.sales_coordinator) {
        customerForm.setFieldValue(
          "sales_coordinator",
          salespersonModalData.sales_coordinator
        );
      } else {
        customerForm.setFieldValue("sales_coordinator", "");
      }
      if (salespersonModalData.customer_service) {
        customerForm.setFieldValue(
          "customer_services",
          salespersonModalData.customer_service
        );
      } else {
        customerForm.setFieldValue("customer_services", "");
      }
      // Close modal first
      closeSalespersonModal();
      setSalespersonModalData(null);

      // Navigate to stepper 1 (Customer Details) - active is 0-indexed, so 0 = step 1
      setTimeout(() => {
        setActive(0);
      }, 200);
    }
  };

  // Function to validate a specific step
  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      const result = customerForm.validate();
      return !result.hasErrors;
    }
    if (stepIndex === 1) {
      const result = serviceForm.validate();
      return !result.hasErrors;
    }
    // Step 2 (Quotation) validation is handled by QuotationCreate component
    return true;
  };

  // Function to handle stepper title click with validation
  const handleStepClick = (targetStep: number) => {
    // Allow backward navigation without validation
    if (targetStep < active) {
      setActive(targetStep);
      return;
    }

    // For forward navigation, validate all steps from current to target
    if (targetStep > active) {
      let allStepsValid = true;
      // Validate each step from current to target (exclusive of target)
      for (let step = active; step < targetStep; step++) {
        const isValid = validateStep(step);
        if (!isValid) {
          allStepsValid = false;
          // Stay on the first invalid step to show errors
          setActive(step);
          break;
        }
      }
      // Only navigate to target if all intermediate steps are valid
      if (allStepsValid) {
        setActive(targetStep);
      }
      // If validation fails, errors are already displayed by form.validate()
    } else {
      // Same step clicked, just navigate
      setActive(targetStep);
    }
  };

  // Function to fetch enquiry data using enquiry_id from chatbot
  const handleNext = () => {
    let validationPassed = true;

    if (active === 0) {
      const result = customerForm.validate();
      if (result.hasErrors) validationPassed = false;
    }

    if (active === 1) {
      const serviceFormResult = serviceForm.validate();
      if (serviceFormResult.hasErrors) validationPassed = false;

      if (!validationPassed) return;

      // Check if this is from destination flow
      if (enq?.fromDestination && enq?.actionType === "createQuote") {
        // For destination flow, navigate to quotation step instead of submitting
        setActive(2);
        return;
      }

      // Submit button always submits the form (no conditional navigation)
      handleFinalSubmit();
      return;
    }

    // Move to next step for active === 0 or 1
    if (validationPassed) {
      setActive((current) => current + 1);
    }
  };
  const { data: enquiryData = [] } = useQuery({
    queryKey: ["enquiryData"],
    queryFn: fetchEnquiry,
    select: (data: any) => data || [],
    staleTime: Infinity,
  });
  const { data: quotationData = [] } = useQuery({
    queryKey: ["quotationData"],
    queryFn: fetchQuotation,
    select: (data: any) => data || [],
    staleTime: Infinity,
  });

  const [selectedCustomerName, setSelectedCustomerName] = useState<
    string | null
  >(null);
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(
    null
  );
  const [isInitialDataLoad, setIsInitialDataLoad] = useState(false);
  const [salespersonsApiCalled, setSalespersonsApiCalled] = useState(false);

  // Customer data drawer state
  const [
    customerDataDrawer,
    { open: openCustomerDataDrawer, close: closeCustomerDataDrawer },
  ] = useDisclosure(false);

  // Customer data state
  const [customerQuotationData, setCustomerQuotationData] = useState<
    QuotationData[]
  >([]);
  const [callEntryData, setCallEntryData] = useState<CallEntryData[]>([]);
  const [shipmentData, setShipmentData] = useState<ShipmentData[]>([]);
  const [potentialProfilingData, setPotentialProfilingData] = useState<
    PotentialProfilingData[]
  >([]);
  const [customerCreditDay, setCustomerCreditDay] = useState<number | null>(
    null
  );
  const [customerSalesperson, setCustomerSalesperson] = useState<string | null>(
    null
  );
  const [customerLastVisited, setCustomerLastVisited] = useState<string | null>(
    null
  );
  const [customerTotalCreditAmount, setCustomerTotalCreditAmount] = useState<
    number | null
  >(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState<number | null>(null);
  // Date range for customer data - default to previous month
  const getPreviousMonthRange = () => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0
    );
    return {
      from: previousMonth,
      to: lastDayOfPreviousMonth,
    };
  };
  const previousMonthRange = getPreviousMonthRange();
  const [customerDataFromDate, setCustomerDataFromDate] = useState<Date | null>(
    previousMonthRange.from
  );
  const [customerDataToDate, setCustomerDataToDate] = useState<Date | null>(
    previousMonthRange.to
  );
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [totalOutstandingAmount, setTotalOutstandingAmount] =
    useState<number>(0);

  const enquiryCount = useMemo(() => {
    if (!selectedCustomerName || !enquiryData?.length) return 0;

    return enquiryData.filter(
      (enq: any) =>
        enq.customer_name?.toLowerCase().trim() ===
        selectedCustomerName.toLowerCase().trim()
    ).length;
  }, [selectedCustomerName, enquiryData]);

  const quotationCount = useMemo(() => {
    if (!selectedCustomerName || !quotationData?.length) return 0;

    return quotationData.filter(
      (quote: any) =>
        quote.customer_name?.toLowerCase().trim() ===
        selectedCustomerName.toLowerCase().trim()
    ).length;
  }, [selectedCustomerName, quotationData]);

  // Optimized container type data query with memoization
  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: fetchContainerType,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const containerTypeData = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];

    return rawContainerData.map((item: any) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: item.container_name,
    }));
  }, [rawContainerData]);

  // Other services data query
  const { data: rawOtherServicesData = [] } = useQuery({
    queryKey: ["otherServices"],
    queryFn: fetchOtherServices,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const otherServicesData = useMemo(() => {
    if (!Array.isArray(rawOtherServicesData) || !rawOtherServicesData.length)
      return [];

    return rawOtherServicesData.map((item: any) => ({
      value: item.service_code ? String(item.service_code) : "",
      label: item.service_name || "",
      transport_mode: item.transport_mode || "",
      full_groupage: item.full_groupage || "",
    }));
  }, [rawOtherServicesData]);

  // Salespersons data query - initially with empty customer_id
  const { data: rawSalespersonsData = [], refetch: refetchSalespersons } =
    useQuery({
      queryKey: ["salespersons", ""],
      queryFn: () => {
        console.log(
          "🚀 React Query calling fetchSalespersons with empty customer_code"
        );
        return fetchSalespersons("");
      },
      staleTime: 10 * 60 * 1000, // 10 minutes - longer cache
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      enabled: true, // Only fetch when component mounts
      retry: 1, // Only retry once on failure
    });

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

  useEffect(() => {
    try {
      console.log("🔍 Main useEffect triggered with enq:", enq);
      if (enq !== null) {
        const hasEnquiryPayload =
          Boolean(enq.actionType) ||
          Boolean(enq.id) ||
          Boolean(enq.enquiry_id) ||
          Boolean(enq.customer_code) ||
          Boolean(enq.customer_code_read) ||
          (Array.isArray(enq.services) && enq.services.length > 0) ||
          (Array.isArray(enq.service_details) &&
            enq.service_details.length > 0);

        if (!hasEnquiryPayload) {
          setShowQuotation(false);
          setActive(0);
          return;
        }

        setIsInitialDataLoad(true);
        if (!Array.isArray(termsOfShipment) || termsOfShipment.length === 0) {
          console.log("Waiting for data to load...");
          return;
        }

        // Check if this is from destination create quote flow
        if (enq.actionType === "createQuote" && enq.fromDestination) {
          setShowQuotation(true); // Show quotation step
          setActive(2); // Go to step 3 (Quotation)
        }
        // Check if this is edit quotation action (navigating back from quotation edit)
        else if (enq.actionType === "editQuotation") {
          setShowQuotation(true); // Show quotation step
          // Use targetStep if provided (from navigation), otherwise default to step 0
          const targetStep = (enq as any)?.targetStep;
          setActive(targetStep !== undefined ? targetStep : 0);
        }
        // Check if this is an edit action (Edit Enquiry)
        else if (enq.actionType === "edit") {
          setShowQuotation(false); // Don't show quotation step for edit
          setActive(0); // Start at step 1 (Customer Details)
        }
        // Check if this is create enquiry from call entry (not create quote)
        else if (enq.actionType === "createEnquiry") {
          setShowQuotation(false); // Don't show quotation step for create enquiry
          setActive(0); // Start at step 1 (Customer Details)
        } else {
          setShowQuotation(true); // Show quotation step for create quote
          setActive(2); // Go to step 3 (Quotation) for create quote
        }

        // Set basic fields first
        console.log("📝 Setting basic fields:", {
          sales_person: enq?.sales_person,
          sales_coordinator: enq?.sales_coordinator,
          customer_services: enq?.customer_services,
          enquiry_received_date: enq?.enquiry_received_date,
          reference_no: enq?.reference_no,
          customer_address: enq?.customer_address,
        });

        customerForm.setFieldValue(
          "sales_coordinator",
          enq?.sales_coordinator || ""
        );
        customerForm.setFieldValue("sales_person", enq?.sales_person || "");
        customerForm.setFieldValue(
          "enquiry_received_date",
          enq?.enquiry_received_date || dayjs().format("YYYY-MM-DD")
        );
        customerForm.setFieldValue("reference_no", enq?.reference_no || "");
        customerForm.setFieldValue(
          "customer_address",
          enq?.customer_address || ""
        );

        // Handle customer selection and sales person population
        if (enq?.customer_code_read) {
          console.log("🏢 Setting customer data:", {
            customer_code: enq.customer_code_read,
            customer_name: enq.customer_name,
            sales_person: enq.sales_person,
          });

          customerForm.setFieldValue("customer_code", enq.customer_code_read);
          setCustomerDisplayName(enq.customer_name || enq.customer_code_read);
          setSelectedCustomerName(enq.customer_name || enq.customer_code_read);

          // If we have sales person data in enquiry, populate it
          if (enq?.sales_person) {
            console.log(
              "👤 Populating sales person from enquiry data:",
              enq.sales_person
            );
            customerForm.setFieldValue("sales_person", enq.sales_person);
            customerForm.setFieldValue(
              "sales_coordinator",
              enq.sales_coordinator || ""
            );
            customerForm.setFieldValue(
              "customer_services",
              enq.customer_services || ""
            );
          }
        }

        // Handle service details - check for new API format with 'services' array
        if (enq?.services && Array.isArray(enq.services)) {
          // New API format: services array
          serviceForm.setFieldValue(
            "service_details",
            enq.services.map((service: any) => {
              // Handle OTHERS service type from quotation (when service_type == "OTHERS" and trade == null)
              let serviceValue = service.service || "";
              let tradeValue = service.trade || "";
              let serviceCodeValue = service.service_code || "";
              let serviceNameValue = service.service_name || "";

              // Check if this is OTHERS type from quotation (service_type == "OTHERS" and trade == null)
              if (
                (service.service_type === "OTHERS" ||
                  service.service === "OTHERS") &&
                (service.trade === null ||
                  service.trade === undefined ||
                  service.trade === "")
              ) {
                serviceValue = "OTHERS";
                tradeValue = "";
                // Use service_type_code and service_type_name if available, otherwise use service_code and service_name
                serviceCodeValue =
                  service.service_type_code || service.service_code || "";
                serviceNameValue =
                  service.service_type_name || service.service_name || "";
              }

              const serviceDetail = {
                id: service.id,
                // Date.now().toString() +
                // Math.random().toString(36).substr(2, 9),
                service: serviceValue,
                trade: tradeValue,
                service_code: serviceCodeValue,
                service_name: serviceNameValue,
                origin_code:
                  service.origin_code_read || service.origin_code || "",
                origin_name: service.origin_name || "",
                destination_code:
                  service.destination_code_read ||
                  service.destination_code ||
                  "",
                destination_name: service.destination_name || "",
                pickup: service.pickup ? "true" : "false",
                delivery: service.delivery ? "true" : "false",
                pickup_location: service.pickup_location || "",
                delivery_location: service.delivery_location || "",
                service_remark: service.service_remark || "",
                commodity: service.commodity || "",
                shipment_terms_code:
                  service.shipment_terms_code_read ||
                  service.shipment_terms_code ||
                  "",
                dimension_unit: "Centimeter",
                diemensions: [] as any[],
                cargo_details: [] as any[],
              };

              // Handle cargo details based on service type
              // For OTHERS services, determine structure from cargo data presence or service_code
              let isOthersWithFCL = false;
              let isOthersWithAIR = false;
              let isOthersWithLCL = false;

              if (serviceValue === "OTHERS" && serviceCodeValue) {
                // Try to determine structure from otherServicesData if available
                const selectedOtherService = (otherServicesData || []).find(
                  (item: any) => item.value === serviceCodeValue
                );
                if (selectedOtherService) {
                  const transportMode =
                    selectedOtherService.transport_mode || "";
                  const fullGroupage = selectedOtherService.full_groupage || "";
                  if (transportMode === "SEA" && fullGroupage === "FULL") {
                    isOthersWithFCL = true;
                  } else if (
                    transportMode === "SEA" &&
                    fullGroupage === "GROUPAGE"
                  ) {
                    isOthersWithLCL = true;
                  } else {
                    isOthersWithAIR = true;
                  }
                } else {
                  // Fallback: determine structure from cargo data presence
                  if (
                    service.fcl_details &&
                    Array.isArray(service.fcl_details) &&
                    service.fcl_details.length > 0
                  ) {
                    isOthersWithFCL = true;
                  } else if (
                    service.volume_weight !== undefined &&
                    service.volume_weight !== null &&
                    (service.volume === undefined || service.volume === null)
                  ) {
                    isOthersWithAIR = true;
                  } else if (
                    service.volume !== undefined &&
                    service.volume !== null &&
                    (service.volume_weight === undefined ||
                      service.volume_weight === null)
                  ) {
                    isOthersWithLCL = true;
                  } else {
                    // Default to AIR structure if we have volume_weight
                    isOthersWithAIR =
                      service.volume_weight !== undefined &&
                      service.volume_weight !== null;
                  }
                }
              }

              if (
                (serviceValue === "FCL" || isOthersWithFCL) &&
                service.fcl_details &&
                Array.isArray(service.fcl_details)
              ) {
                // FCL service with multiple containers (or OTHERS with FCL structure)
                serviceDetail.cargo_details = service.fcl_details.map(
                  (fcl: any) => ({
                    id: fcl.id || null,
                    no_of_packages: null,
                    gross_weight: fcl.gross_weight
                      ? Number(fcl.gross_weight)
                      : null,
                    volume_weight: null,
                    chargable_weight: null,
                    volume: null,
                    chargable_volume: null,
                    // Use container_type_code if available, otherwise fallback to container_type
                    container_type_code:
                      fcl.container_type_code || fcl.container_type || null,
                    no_of_containers: fcl.no_of_containers || null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    stackable: service.stackable ? "Yes" : "No",
                  })
                );
              } else if (serviceValue === "AIR" || isOthersWithAIR) {
                // AIR service with direct cargo fields (or OTHERS with AIR structure)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: service.volume_weight
                      ? Number(service.volume_weight)
                      : null,
                    chargable_weight: service.chargeable_weight
                      ? Number(service.chargeable_weight)
                      : null,
                    volume: null,
                    chargable_volume: null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              } else if (serviceValue === "LCL" || isOthersWithLCL) {
                // LCL service with direct cargo fields (or OTHERS with LCL structure)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: null,
                    chargable_weight: null,
                    volume: service.volume ? Number(service.volume) : null,
                    chargable_volume: service.chargeable_volume
                      ? Number(service.chargeable_volume)
                      : null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              } else {
                // Default cargo detail (for OTHERS when structure cannot be determined from data)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: service.volume_weight
                      ? Number(service.volume_weight)
                      : null,
                    chargable_weight: service.chargeable_weight
                      ? Number(service.chargeable_weight)
                      : null,
                    volume: service.volume ? Number(service.volume) : null,
                    chargable_volume: service.chargeable_volume
                      ? Number(service.chargeable_volume)
                      : null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              }

              // Handle dimension_data mapping from API response
              if (
                service.dimension_data &&
                Array.isArray(service.dimension_data) &&
                service.dimension_data.length > 0
              ) {
                // Map dimension_data to diemensions format
                serviceDetail.diemensions = service.dimension_data.map(
                  (dim: any) => ({
                    id: dim.id || null,
                    pieces: dim.pieces || 0,
                    length: dim.length || 0,
                    width: dim.width || 0,
                    height: dim.height || 0,
                    value: dim.value || 0,
                    vol_weight: dim.volume_weight || 0,
                  })
                );

                // Extract dimension_unit from first dimension item (all should have same unit)
                if (service.dimension_data[0]?.dimension_unit) {
                  serviceDetail.dimension_unit =
                    service.dimension_data[0].dimension_unit;
                }
              }

              return serviceDetail;
            })
          );
        } else if (enq?.service_details && Array.isArray(enq.service_details)) {
          // Legacy format: service_details array
          serviceForm.setFieldValue(
            "service_details",
            enq.service_details.map((service: any) => {
              const serviceDetail = {
                id: service.id,
                // Date.now().toString() + Math.random().toString(36).substr(2, 9),
                service: service.service || "",
                trade: service.trade || "",
                service_code: service.service_code || "",
                service_name: service.service_name || "",
                origin_code:
                  service.origin_code_read || service.origin_code || "",
                origin_name: service.origin_name || "",
                destination_code:
                  service.destination_code_read ||
                  service.destination_code ||
                  "",
                destination_name: service.destination_name || "",
                pickup: service.pickup ? "true" : "false",
                delivery: service.delivery ? "true" : "false",
                pickup_location: service.pickup_location || "",
                delivery_location: service.delivery_location || "",
                service_remark: service.service_remark || "",
                commodity: service.commodity || "",
                shipment_terms_code:
                  service.shipment_terms_code_read ||
                  service.shipment_terms_code ||
                  "",
                dimension_unit: "Centimeter",
                diemensions: [] as any[],
                cargo_details: [] as any[],
              };

              // Handle cargo details based on service type
              // For OTHERS services, determine structure from cargo data presence or service_code
              let isOthersWithFCL = false;
              let isOthersWithAIR = false;
              let isOthersWithLCL = false;

              if (service.service === "OTHERS" && service.service_code) {
                // Try to determine structure from otherServicesData if available
                const selectedOtherService = (otherServicesData || []).find(
                  (item: any) => item.value === service.service_code
                );
                if (selectedOtherService) {
                  const transportMode =
                    selectedOtherService.transport_mode || "";
                  const fullGroupage = selectedOtherService.full_groupage || "";
                  if (transportMode === "SEA" && fullGroupage === "FULL") {
                    isOthersWithFCL = true;
                  } else if (
                    transportMode === "SEA" &&
                    fullGroupage === "GROUPAGE"
                  ) {
                    isOthersWithLCL = true;
                  } else {
                    isOthersWithAIR = true;
                  }
                } else {
                  // Fallback: determine structure from cargo data presence
                  if (
                    service.fcl_details &&
                    Array.isArray(service.fcl_details) &&
                    service.fcl_details.length > 0
                  ) {
                    isOthersWithFCL = true;
                  } else if (
                    service.volume_weight !== undefined &&
                    service.volume_weight !== null &&
                    (service.volume === undefined || service.volume === null)
                  ) {
                    isOthersWithAIR = true;
                  } else if (
                    service.volume !== undefined &&
                    service.volume !== null &&
                    (service.volume_weight === undefined ||
                      service.volume_weight === null)
                  ) {
                    isOthersWithLCL = true;
                  } else {
                    // Default to AIR structure if we have volume_weight
                    isOthersWithAIR =
                      service.volume_weight !== undefined &&
                      service.volume_weight !== null;
                  }
                }
              }

              if (
                (service.service === "FCL" || isOthersWithFCL) &&
                service.fcl_details &&
                Array.isArray(service.fcl_details)
              ) {
                // FCL service with multiple containers (or OTHERS with FCL structure)
                serviceDetail.cargo_details = service.fcl_details.map(
                  (fcl: any) => ({
                    id: fcl.id || null,
                    no_of_packages: null,
                    gross_weight: fcl.gross_weight
                      ? Number(fcl.gross_weight)
                      : null,
                    volume_weight: null,
                    chargable_weight: null,
                    volume: null,
                    chargable_volume: null,
                    container_type_code:
                      fcl.container_type_code || fcl.container_type || null,
                    no_of_containers: fcl.no_of_containers || null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    stackable: service.stackable ? "Yes" : "No",
                  })
                );
              } else if (service.service === "AIR" || isOthersWithAIR) {
                // AIR service with direct cargo fields (or OTHERS with AIR structure)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: service.volume_weight
                      ? Number(service.volume_weight)
                      : null,
                    chargable_weight: service.chargeable_weight
                      ? Number(service.chargeable_weight)
                      : null,
                    volume: null,
                    chargable_volume: null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              } else if (service.service === "LCL" || isOthersWithLCL) {
                // LCL service with direct cargo fields (or OTHERS with LCL structure)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: null,
                    chargable_weight: null,
                    volume: service.volume ? Number(service.volume) : null,
                    chargable_volume: service.chargeable_volume
                      ? Number(service.chargeable_volume)
                      : null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              } else {
                // Default cargo detail (for OTHERS when structure cannot be determined from data)
                serviceDetail.cargo_details = [
                  {
                    id: null,
                    no_of_packages: service.no_of_packages || null,
                    gross_weight: service.gross_weight
                      ? Number(service.gross_weight)
                      : null,
                    volume_weight: service.volume_weight
                      ? Number(service.volume_weight)
                      : null,
                    chargable_weight: service.chargeable_weight
                      ? Number(service.chargeable_weight)
                      : null,
                    volume: service.volume ? Number(service.volume) : null,
                    chargable_volume: service.chargeable_volume
                      ? Number(service.chargeable_volume)
                      : null,
                    container_type_code: null,
                    no_of_containers: null,
                    hazardous_cargo: service.hazardous_cargo ? "Yes" : "No",
                    stackable: service.stackable ? "Yes" : "No",
                  },
                ];
              }

              // COMMENTED OUT TO FIX INFINITE LOOP - Handle dimension_data mapping from API response
              // if (
              //   service.dimension_data &&
              //   Array.isArray(service.dimension_data) &&
              //   service.dimension_data.length > 0
              // ) {
              //   // Map dimension_data to diemensions format
              //   serviceDetail.diemensions = service.dimension_data.map(
              //     (dim: any) => ({
              //       id: dim.id || null,
              //       pieces: dim.pieces || 0,
              //       length: dim.length || 0,
              //       width: dim.width || 0,
              //       height: dim.height || 0,
              //       value: dim.value || 0,
              //       vol_weight: dim.volume_weight || 0,
              //     })
              //   );

              //   // Extract dimension_unit from first dimension item (all should have same unit)
              //   if (service.dimension_data[0]?.dimension_unit) {
              //     serviceDetail.dimension_unit =
              //       service.dimension_data[0].dimension_unit;
              //   }
              // }

              return serviceDetail;
            })
          );
        } else {
          // Legacy format: single service detail (backward compatibility)
          const serviceDetail = {
            id: enq.id,
            // Date.now().toString() + Math.random().toString(36).substr(2, 9),
            service: enq?.service || "",
            trade: enq?.trade || "",
            service_code: enq?.service_code || "",
            service_name: enq?.service_name || "",
            origin_code: enq?.origin_code_read || enq?.origin_code || "",
            origin_name: enq?.origin_name || "",
            destination_code:
              enq?.destination_code_read || enq?.destination_code || "",
            destination_name: enq?.destination_name || "",
            pickup: enq?.pickup ? "true" : "false",
            delivery: enq?.delivery ? "true" : "false",
            pickup_location: enq?.pickup_location || "",
            delivery_location: enq?.delivery_location || "",
            shipment_terms_code:
              enq?.shipment_terms_code_read || enq?.shipment_terms_code || "",
            service_remark: enq?.service_remark || "",
            commodity: enq?.commodity || "",
            dimension_unit: "Centimeter",
            diemensions: [],
            cargo_details: [] as any[],
          };

          // Handle cargo details based on service type
          // For OTHERS services, determine structure from cargo data presence or service_code
          let isOthersWithFCL = false;
          let isOthersWithAIR = false;
          let isOthersWithLCL = false;

          if (enq?.service === "OTHERS" && enq.service_code) {
            // Try to determine structure from otherServicesData if available
            const selectedOtherService = (otherServicesData || []).find(
              (item: any) => item.value === enq.service_code
            );
            if (selectedOtherService) {
              const transportMode = selectedOtherService.transport_mode || "";
              const fullGroupage = selectedOtherService.full_groupage || "";
              if (transportMode === "SEA" && fullGroupage === "FULL") {
                isOthersWithFCL = true;
              } else if (
                transportMode === "SEA" &&
                fullGroupage === "GROUPAGE"
              ) {
                isOthersWithLCL = true;
              } else {
                isOthersWithAIR = true;
              }
            } else {
              // Fallback: determine structure from cargo data presence
              if (
                enq.fcl_details &&
                Array.isArray(enq.fcl_details) &&
                enq.fcl_details.length > 0
              ) {
                isOthersWithFCL = true;
              } else if (
                enq.volume_weight !== undefined &&
                enq.volume_weight !== null &&
                (enq.volume === undefined || enq.volume === null)
              ) {
                isOthersWithAIR = true;
              } else if (
                enq.volume !== undefined &&
                enq.volume !== null &&
                (enq.volume_weight === undefined || enq.volume_weight === null)
              ) {
                isOthersWithLCL = true;
              } else {
                // Default to AIR structure if we have volume_weight
                isOthersWithAIR =
                  enq.volume_weight !== undefined && enq.volume_weight !== null;
              }
            }
          }

          if (
            (enq?.service === "FCL" || isOthersWithFCL) &&
            enq.fcl_details &&
            Array.isArray(enq.fcl_details)
          ) {
            // FCL service with multiple containers (or OTHERS with FCL structure)
            serviceDetail.cargo_details = enq.fcl_details.map((fcl: any) => ({
              id: fcl.id || null,
              no_of_packages: null,
              gross_weight: fcl.gross_weight ? Number(fcl.gross_weight) : null,
              volume_weight: null,
              chargable_weight: null,
              volume: null,
              chargable_volume: null,
              container_type_code:
                fcl.container_type_code || fcl.container_type || null,
              no_of_containers: fcl.no_of_containers || null,
              hazardous_cargo: enq.hazardous_cargo ? "Yes" : "No",
              stackable: enq.stackable ? "Yes" : "No",
            }));
          } else if (enq?.service === "AIR" || isOthersWithAIR) {
            // AIR service with direct cargo fields (or OTHERS with AIR structure)
            serviceDetail.cargo_details = [
              {
                id: null,
                no_of_packages: enq.no_of_packages || null,
                gross_weight: enq.gross_weight
                  ? Number(enq.gross_weight)
                  : null,
                volume_weight: enq.volume_weight
                  ? Number(enq.volume_weight)
                  : null,
                chargable_weight: enq.chargeable_weight
                  ? Number(enq.chargeable_weight)
                  : null,
                volume: null,
                chargable_volume: null,
                container_type_code: null,
                no_of_containers: null,
                hazardous_cargo: enq.hazardous_cargo ? "Yes" : "No",
                stackable: enq.stackable ? "Yes" : "No",
              },
            ];
          } else if (enq?.service === "LCL" || isOthersWithLCL) {
            // LCL service with direct cargo fields (or OTHERS with LCL structure)
            serviceDetail.cargo_details = [
              {
                id: null,
                no_of_packages: enq.no_of_packages || null,
                gross_weight: enq.gross_weight
                  ? Number(enq.gross_weight)
                  : null,
                volume_weight: null,
                chargable_weight: null,
                volume: enq.volume ? Number(enq.volume) : null,
                chargable_volume: enq.chargeable_volume
                  ? Number(enq.chargeable_volume)
                  : null,
                container_type_code: null,
                no_of_containers: null,
                hazardous_cargo: enq.hazardous_cargo ? "Yes" : "No",
                stackable: enq.stackable ? "Yes" : "No",
              },
            ];
          } else {
            // Default cargo detail (for OTHERS when structure cannot be determined from data)
            serviceDetail.cargo_details = [
              {
                id: null,
                no_of_packages: enq.no_of_packages || null,
                gross_weight: enq.gross_weight
                  ? Number(enq.gross_weight)
                  : null,
                volume_weight: enq.volume_weight
                  ? Number(enq.volume_weight)
                  : null,
                chargable_weight: enq.chargeable_weight
                  ? Number(enq.chargeable_weight)
                  : null,
                volume: enq.volume ? Number(enq.volume) : null,
                chargable_volume: enq.chargeable_volume
                  ? Number(enq.chargeable_volume)
                  : null,
                container_type_code: null,
                no_of_containers: null,
                hazardous_cargo: enq.hazardous_cargo ? "Yes" : "No",
                stackable: enq.stackable ? "Yes" : "No",
              },
            ];
          }

          // Handle dimension_data mapping from API response
          if (
            enq.dimension_data &&
            Array.isArray(enq.dimension_data) &&
            enq.dimension_data.length > 0
          ) {
            // Map dimension_data to diemensions format
            serviceDetail.diemensions = enq.dimension_data.map((dim: any) => ({
              id: dim.id || null,
              pieces: dim.pieces || 0,
              length: dim.length || 0,
              width: dim.width || 0,
              height: dim.height || 0,
              value: dim.value || 0,
              vol_weight: dim.volume_weight || 0,
            }));

            // Extract dimension_unit from first dimension item (all should have same unit)
            if (enq.dimension_data[0]?.dimension_unit) {
              serviceDetail.dimension_unit =
                enq.dimension_data[0].dimension_unit;
            }
          }

          serviceForm.setFieldValue("service_details", [serviceDetail]);
        }

        // Handle documents_list for supporting documents in edit mode
        if (enq?.documents_list && Array.isArray(enq.documents_list)) {
          const documents = enq.documents_list.map((doc: any) => ({
            name: doc.document_name || "",
            file: null, // Existing files don't need File object
            document_url: doc.document_url || "",
            document_id: doc.id || undefined,
            original_document_name: doc.file_name || "", // Store original file name from file_name key
          }));
          customerForm.setFieldValue("supporting_documents", documents);
        }

        // Note: Origin and destination display names will be handled by the SearchableSelect components
      }
      setIsInitialDataLoad(false); // Reset flag after data loading is complete
    } catch (error) {
      console.error("Error processing enquiry data:", error);
      setError(
        `Error processing enquiry data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }, [enq, termsOfShipment]);

  // Remove the auto-open chatbot logic completely
  // useEffect(() => {
  //   // Removed auto-open chatbot logic - chatbot is now global
  // }, [active]);

  // Store original values when edit data is loaded (for AIR/LCL services) - COMMENTED OUT TO FIX INFINITE LOOP
  // useEffect(() => {
  //   if (
  //     enq &&
  //     enq.actionType === "edit" &&
  //     serviceForm.values.service_details.length > 0
  //   ) {
  //     serviceForm.values.service_details.forEach(
  //       (serviceDetail, serviceIndex) => {
  //         if (
  //           serviceDetail.service === "AIR" ||
  //           serviceDetail.service === "LCL"
  //         ) {
  //           const key = `${serviceIndex}-${serviceDetail.service}`;
  //           const cargo = serviceDetail.cargo_details[0];
  //           if (cargo && !originalValuesRef.current[key]) {
  //             originalValuesRef.current[key] = {
  //               no_of_packages: cargo.no_of_packages || null,
  //               volume:
  //                 serviceDetail.service === "LCL"
  //                   ? cargo.volume || null
  //                   : undefined,
  //               volume_weight:
  //                 serviceDetail.service === "AIR"
  //                   ? cargo.volume_weight || null
  //                   : undefined,
  //             };
  //           }
  //         }
  //       }
  //     );
  //   }
  // }, [enq, serviceForm.values.service_details]);

  // useEffect to check salesperson data when customer, service, and trade are all selected
  useEffect(() => {
    const customerCode = customerForm.values.customer_code;

    if (!customerCode) {
      return;
    }

    // Check all service details
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    serviceForm.values.service_details.forEach(
      (serviceDetail, serviceIndex) => {
        const service = serviceDetail?.service;
        const trade = serviceDetail?.trade;

        if (service && trade && lastCheckedServiceIndex !== serviceIndex) {
          // Small delay to ensure form values are updated
          const timeoutId = setTimeout(() => {
            checkSalespersonData(serviceIndex);
          }, 300);
          timeouts.push(timeoutId);
        }
      }
    );

    // Cleanup function
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [
    customerForm.values.customer_code,
    serviceForm.values.service_details,
    lastCheckedServiceIndex,
  ]);

  // Additional effect to populate fields when data is loaded
  useEffect(() => {
    if (enq && Array.isArray(termsOfShipment) && termsOfShipment.length > 0) {
      console.log("Data loaded, attempting to populate fields again");
      console.log("Current form values:", {
        service_details: serviceForm.values.service_details,
      });

      // Try to populate shipment terms field for each service detail
      serviceForm.values.service_details.forEach((serviceDetail, index) => {
        if (enq.shipment_terms_code && !serviceDetail.shipment_terms_code) {
          const tosOption = (termsOfShipment as TermsOfShipmentData[]).find(
            (item: TermsOfShipmentData) =>
              item.tos_code === enq.shipment_terms_code
          );
          if (tosOption) {
            console.log(
              "Setting shipment_terms_code from data loaded effect:",
              tosOption.tos_code
            );
            serviceForm.setFieldValue(
              `service_details.${index}.shipment_terms_code`,
              tosOption.tos_code
            );
          }
        }

        if (
          enq.shipment_terms_code_read &&
          !serviceDetail.shipment_terms_code
        ) {
          const tosOption = (termsOfShipment as TermsOfShipmentData[]).find(
            (item: TermsOfShipmentData) =>
              item.tos_code === enq.shipment_terms_code_read
          );
          if (tosOption) {
            console.log(
              "Setting shipment_terms_code from shipment_terms_code_read:",
              tosOption.tos_code
            );
            serviceForm.setFieldValue(
              `service_details.${index}.shipment_terms_code`,
              tosOption.tos_code
            );
          }
        }
      });
    }
  }, [enq, termsOfShipment, serviceForm.values.service_details]);

  // Additional effect to handle sales person population in edit mode after salespersons data is loaded
  useEffect(() => {
    // console.log("🔧 Edit mode effect triggered:", {
    //   hasEnq: !!enq,
    //   actionType: enq?.actionType,
    //   salespersonsDataLength: salespersonsData.length,
    //   enquirySalesPerson: enq?.sales_person,
    //   currentSalesPerson: customerForm.values.sales_person,
    // });

    if (enq && enq.actionType === "edit" && salespersonsData.length > 0) {
      // If we have sales person data in enquiry and salespersons are loaded, ensure it's populated
      if (enq.sales_person && !customerForm.values.sales_person) {
        console.log(
          "✅ Populating sales person fields in edit mode:",
          enq.sales_person
        );
        customerForm.setFieldValue("sales_person", enq.sales_person);
        customerForm.setFieldValue(
          "sales_coordinator",
          enq.sales_coordinator || ""
        );
        customerForm.setFieldValue(
          "customer_services",
          enq.customer_services || ""
        );
      }
    }
  }, [enq, salespersonsData]);

  // Final verification effect to ensure sales person is populated in edit mode
  useEffect(() => {
    if (
      enq &&
      enq.actionType === "edit" &&
      enq.sales_person &&
      !isInitialDataLoad
    ) {
      console.log("🔍 Final verification - checking sales person field:", {
        enquirySalesPerson: enq.sales_person,
        currentSalesPerson: customerForm.values.sales_person,
        salespersonsDataLength: salespersonsData.length,
      });

      // If sales person is not populated but we have the data, populate it
      if (!customerForm.values.sales_person && salespersonsData.length > 0) {
        console.log("🔄 Final population of sales person:", enq.sales_person);
        customerForm.setFieldValue("sales_person", enq.sales_person);
        customerForm.setFieldValue(
          "sales_coordinator",
          enq.sales_coordinator || ""
        );
        customerForm.setFieldValue(
          "customer_services",
          enq.customer_services || ""
        );
      }
    }
  }, [
    enq,
    // customerForm.values.sales_person,
    salespersonsData.length,
    isInitialDataLoad,
  ]);

  // Track component mount to prevent duplicate API calls
  useEffect(() => {
    console.log("🏁 EnquiryCreate component mounted");
    return () => {
      console.log("🏁 EnquiryCreate component unmounted");
    };
  }, []);

  // Function to handle customer selection and refetch salespersons
  const handleCustomerSelection = async (customerId: string) => {
    console.log(
      "🎯 handleCustomerSelection called with customerId:",
      customerId,
      "Timestamp:",
      new Date().toISOString()
    );

    // Only refetch if customerId is different from current
    if (!customerId) {
      console.log("🔄 Resetting to initial state");
      // Reset to initial state
      if (!salespersonsApiCalled) {
        refetchSalespersons();
        setSalespersonsApiCalled(true);
      }
      return;
    }

    // Refetch salespersons with the selected customer_id
    try {
      console.log("📞 Calling fetchSalespersons for customer:", customerId);
      const response = (await fetchSalespersons(
        customerId
      )) as SalespersonsResponse;

      if (response?.success && response?.data) {
        // Case 2: If API returns single salesperson, auto-fill all fields
        if (response.data.length === 1) {
          const salesperson = response.data[0];
          customerForm.setFieldValue(
            "sales_person",
            salesperson.sales_person || ""
          );
          customerForm.setFieldValue(
            "sales_coordinator",
            salesperson.sales_coordinator || ""
          );
          customerForm.setFieldValue(
            "customer_services",
            salesperson.customer_service || ""
          );
        } else if (response.data.length > 1) {
          // Case 1: Multiple salespersons - clear fields and let user select
          customerForm.setFieldValue("sales_person", "");
          customerForm.setFieldValue("sales_coordinator", "");
          customerForm.setFieldValue("customer_services", "");
        }
      } else if (!response?.success) {
        // If API fails, don't do any action
        console.log("Salespersons API failed:", response?.message);
      }
    } catch (error) {
      console.error("Error fetching salespersons for customer:", error);
    }
  };

  const fetchCustomerData = async (
    customerCode: string,
    fromDate?: Date | null,
    toDate?: Date | null
  ) => {
    try {
      setIsLoadingData(true);

      // Use provided dates or current state values
      const fromDateToUse = fromDate ?? customerDataFromDate;
      const toDateToUse = toDate ?? customerDataToDate;

      if (!fromDateToUse || !toDateToUse) {
        console.error("Date range is required");
        setIsLoadingData(false);
        return;
      }

      // Format dates as YYYY-MM-DD
      const dateFrom = dayjs(fromDateToUse).format("YYYY-MM-DD");
      const dateTo = dayjs(toDateToUse).format("YYYY-MM-DD");

      const payload: {
        customer_code: string;
        date_from: string;
        date_to: string;
      } = {
        customer_code: customerCode,
        date_from: dateFrom,
        date_to: dateTo,
      };

      const customerData = (await postAPICall(
        `${URL.customerData}?index=0&limit=5`,
        payload as any
      )) as CustomerDataResponse;

      // Extract data from the new combined API response
      if (customerData) {
        // Set customer name from customer_info if available
        if (
          customerData.customer_info &&
          customerData.customer_info.customer_name
        ) {
          setSelectedCustomerName(customerData.customer_info.customer_name);
        }

        // Set customer info fields
        if (customerData.customer_info) {
          setCustomerCreditDay(customerData.customer_info.credit_day);
          setCustomerSalesperson(customerData.customer_info.salesperson);
          setCustomerLastVisited(customerData.customer_info.last_visited);
          setCustomerTotalCreditAmount(
            customerData.customer_info.total_credit_amount
          );
          setTotalRevenue(
            customerData.customer_info.overall_total_revenue ?? null
          );
          setTotalProfit(customerData.customer_info.overall_total_gp ?? null);
          if (customerData.customer_info.total_net_balance !== undefined) {
            setTotalOutstandingAmount(
              customerData.customer_info.total_net_balance
            );
          }
        }

        // Set quotations data
        if (customerData.quotations && customerData.quotations.data) {
          setCustomerQuotationData(customerData.quotations.data);
        }

        // Set call entries data
        if (customerData.call_entries && customerData.call_entries.data) {
          setCallEntryData(customerData.call_entries.data);
        }

        // Set shipment data
        if (customerData.shipment && customerData.shipment.data) {
          setShipmentData(customerData.shipment.data);
        } else {
          setShipmentData([]);
        }

        // Set potential profiling data
        if (
          customerData.potential_profiling &&
          customerData.potential_profiling.data
        ) {
          setPotentialProfilingData(customerData.potential_profiling.data);
        } else {
          setPotentialProfilingData([]);
        }
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
      ToastNotification({
        type: "error",
        message: "Failed to fetch customer data",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  if (error) {
    return (
      <Box p="md" maw={1200} mx="auto">
        <Text color="red" size="lg" ta="center">
          Something went wrong: {error}
        </Text>
        <Button mt="md" onClick={() => setError(null)} color="#105476">
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box
        style={{
          backgroundColor: "#F8F8F8",
          position: "relative",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
          {/* Header */}

          <Flex
            gap="md"
            align="flex-start"
            style={{ height: "calc(100vh - 112px)", width: "100%" }}
          >
            {/* Vertical Stepper Sidebar - Hide when QuotationCreate has its own stepper */}
            {!(showQuotation && active === 2) && (
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
                }}
              >
                <Box
                  style={{
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
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
                    {(() => {
                      // Determine title based on actionType and whether quotation step is shown
                      if (enq?.actionType === "editQuotation") {
                        return "Edit Quotation";
                      } else if (enq?.actionType === "createQuote") {
                        return "Create Quotation";
                      } else if (enq?.actionType === "edit") {
                        return "Edit Enquiry";
                      } else if (enq?.id || enq?.enquiry_id) {
                        // Only check for actual enquiry ID, not form values (which could be from create mode)
                        return "Edit Enquiry";
                      } else {
                        return "Create New Enquiry";
                      }
                    })()}
                  </Text>
                </Box>
                <Stack gap="sm" style={{ height: "100%", padding: "10px" }}>
                  <Box
                    onClick={() => handleStepClick(0)}
                    style={{
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.2s",
                    }}
                  >
                    <Flex align="center" gap="sm">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: active > 0 ? "#EAF9F1" : "#E6F2F8",
                          border:
                            active > 0
                              ? "none"
                              : active === 0
                                ? "2px solid #105476"
                                : "2px solid #d1d5db",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: 600,
                          color:
                            active > 0
                              ? "white"
                              : active === 0
                                ? "#105476"
                                : "#9ca3af",
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        {active > 0 ? (
                          <IconCircleCheck
                            size={20}
                            color="#289D69"
                            fill="#EAF9F1"
                          />
                        ) : (
                          // <IconCheck size={20} />
                          <IconUser size={20} color="#105476" fill="#E6F2F8" />
                        )}
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
                        // marginLeft: "19px", // Center it with the icon (40px / 2 = 20px, minus 1px for border)
                      }}
                    />
                  </Box>

                  <Box
                    onClick={() => handleStepClick(1)}
                    style={{
                      cursor: "pointer",
                      padding: "4px 0",
                      transition: "all 0.2s",
                    }}
                  >
                    <Flex align="center" gap="sm">
                      <Box
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: active > 1 ? "#EAF9F1" : "#fff",
                          border:
                            active > 1
                              ? "none"
                              : active === 1
                                ? "2px solid #105476"
                                : "2px solid #d1d5db",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: 600,
                          color:
                            active > 1
                              ? "white"
                              : active === 1
                                ? "#105476"
                                : "#9ca3af",
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        {active > 1 ? (
                          <IconCircleCheck
                            size={20}
                            color="#289D69"
                            fill="#EAF9F1"
                          />
                        ) : (
                          <IconTruckDelivery
                            size={20}
                            color="#105476"
                            fill="#E6F2F8"
                          />
                        )}
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

                  {showQuotation && (
                    <>
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

                      <Box
                        onClick={() => handleStepClick(2)}
                        style={{
                          cursor: "pointer",
                          padding: "4px 0",
                          transition: "all 0.2s",
                        }}
                      >
                        <Flex align="center" gap="sm">
                          <Box
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              backgroundColor: active > 2 ? "#EAF9F1" : "#fff",
                              border:
                                active > 2
                                  ? "none"
                                  : active === 2
                                    ? "2px solid #105476"
                                    : "2px solid #d1d5db",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "16px",
                              fontWeight: 600,
                              color:
                                active > 2
                                  ? "white"
                                  : active === 2
                                    ? "#105476"
                                    : "#9ca3af",
                              transition: "all 0.2s",
                              flexShrink: 0,
                            }}
                          >
                            {active > 2 ? (
                              <IconCircleCheck
                                size={20}
                                color="#289D69"
                                fill="#EAF9F1"
                              />
                            ) : (
                              <IconFileText
                                size={20}
                                color="#105476"
                                fill="#E6F2F8"
                              />
                            )}
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
                    </>
                  )}
                </Stack>
              </Box>
            )}

            {/* Main Content Area */}
            <Box
              style={{
                flex: 1,
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                height: "calc(100vh - 100px)",
                overflow: "hidden",
              }}
            >
              {active === 0 && (
                <>
                  <Box
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      paddingBottom: "16px",
                      backgroundColor: "#F8F8F8",
                    }}
                  >
                    <Grid
                      style={{ backgroundColor: "#FFFFFF", padding: "10px" }}
                    >
                      <Grid.Col span={6}>
                        <Flex gap="sm" align="flex-end">
                          <div
                            style={{
                              flex: customerForm.values.customer_code
                                ? 0.75
                                : 1,
                              transition: "flex 0.3s ease",
                            }}
                          >
                            <SearchableSelect
                              key={customerForm.key("customer_code")}
                              label="Customer Name"
                              required
                              apiEndpoint={URL.customer}
                              placeholder="Type customer name"
                              searchFields={["customer_code", "customer_name"]}
                              returnOriginalData={true}
                              displayFormat={(item: any) => ({
                                value: String(item.customer_code),
                                label: String(item.customer_name), // Show only customer name
                              })}
                              value={customerForm.values.customer_code}
                              displayValue={customerDisplayName}
                              onChange={(value, selectedData, originalData) => {
                                customerForm.setFieldValue(
                                  "customer_code",
                                  value || ""
                                );
                                // Update display name and selected name
                                if (value && selectedData) {
                                  const customerName = selectedData.label;
                                  setCustomerDisplayName(customerName);
                                  setSelectedCustomerName(customerName);

                                  // Extract primary address from originalData
                                  if (
                                    originalData &&
                                    typeof originalData === "object"
                                  ) {
                                    const customerData = originalData as any;
                                    if (
                                      customerData.addresses_data &&
                                      Array.isArray(customerData.addresses_data)
                                    ) {
                                      // Find primary address (case-insensitive match)
                                      const primaryAddress =
                                        customerData.addresses_data.find(
                                          (addr: any) =>
                                            addr?.address_type &&
                                            addr.address_type.toUpperCase() ===
                                              "PRIMARY"
                                        );

                                      // Set customer_address only if:
                                      // 1. Not initial load AND not in edit mode, OR
                                      // 2. Not initial load AND in edit mode but customer changed, OR
                                      // 3. Not initial load AND in edit mode and customer_address is empty
                                      const shouldSetAddress =
                                        !isInitialDataLoad &&
                                        (enq?.actionType !== "edit" ||
                                          enq?.customer_code_read !== value ||
                                          !customerForm.values
                                            .customer_address);

                                      if (
                                        primaryAddress?.address &&
                                        shouldSetAddress
                                      ) {
                                        customerForm.setFieldValue(
                                          "customer_address",
                                          primaryAddress.address
                                        );
                                      }
                                    }
                                  }

                                  // Only call handleCustomerSelection if this is not initial data load and not edit mode or if customer changed
                                  if (
                                    !isInitialDataLoad &&
                                    (enq?.actionType !== "edit" ||
                                      enq?.customer_code_read !== value)
                                  ) {
                                    handleCustomerSelection(value);
                                  }

                                  // Check salesperson data if service and trade are already selected
                                  // Check all service details
                                  serviceForm.values.service_details.forEach(
                                    (_, idx) => {
                                      const serviceDetail =
                                        serviceForm.values.service_details[idx];
                                      if (
                                        serviceDetail?.service &&
                                        serviceDetail?.trade
                                      ) {
                                        setTimeout(() => {
                                          checkSalespersonData(idx);
                                        }, 200);
                                      }
                                    }
                                  );
                                } else {
                                  setCustomerDisplayName(null);
                                  setSelectedCustomerName(null);
                                  // Clear customer_address when customer is cleared
                                  customerForm.setFieldValue(
                                    "customer_address",
                                    ""
                                  );
                                  // Reset salespersons to initial state (empty customer_id)
                                  if (
                                    !isInitialDataLoad &&
                                    enq?.actionType !== "edit" &&
                                    !salespersonsApiCalled
                                  ) {
                                    console.log(
                                      "🔄 Customer cleared - refetching salespersons"
                                    );
                                    refetchSalespersons();
                                    setSalespersonsApiCalled(true);
                                  }
                                }
                              }}
                              error={
                                customerForm.errors.customer_code as string
                              }
                              minSearchLength={3}
                            />
                          </div>

                          {customerForm.values.customer_code && (
                            <div style={{ flex: 0.25 }}>
                              <Button
                                size="xs"
                                mb={4}
                                color="#105476"
                                // variant="outline"
                                onClick={() => {
                                  const customerCode =
                                    customerForm.values.customer_code;
                                  if (customerCode) {
                                    fetchCustomerData(
                                      customerCode,
                                      customerDataFromDate,
                                      customerDataToDate
                                    );
                                    openCustomerDataDrawer();
                                  }
                                }}
                              >
                                {/* {customerForm.values.customer_code} */}
                                <IconInfoCircle size={16} />
                              </Button>
                            </div>
                          )}
                        </Flex>
                        <Drawer
                          opened={customerDataDrawer}
                          onClose={() => {
                            closeCustomerDataDrawer();
                            setCustomerQuotationData([]);
                            setCallEntryData([]);
                            setShipmentData([]);
                            setPotentialProfilingData([]);
                            setCustomerCreditDay(null);
                            setCustomerSalesperson(null);
                            setCustomerLastVisited(null);
                            setCustomerTotalCreditAmount(null);
                            setTotalRevenue(null);
                            setTotalProfit(null);
                            // Reset date range to previous month
                            const previousMonthRange = getPreviousMonthRange();
                            setCustomerDataFromDate(previousMonthRange.from);
                            setCustomerDataToDate(previousMonthRange.to);
                          }}
                          title={`Customer Data for ${selectedCustomerName || customerForm.values.customer_code}`}
                          size={"70%"}
                          position="right"
                        >
                          <Divider mb={"md"} />

                          {isLoadingData ? (
                            <Box ta="center" py="xl">
                              <Loader size="lg" color="#105476" />
                              <Text mt="md" c="dimmed" size="lg">
                                Loading customer data...
                              </Text>
                            </Box>
                          ) : (
                            <Stack gap="lg">
                              {/* Customer Info Section */}
                              {(customerCreditDay !== null ||
                                customerSalesperson ||
                                customerLastVisited ||
                                customerTotalCreditAmount !== null ||
                                totalOutstandingAmount !== 0 ||
                                totalRevenue !== null ||
                                totalProfit !== null) && (
                                <Box>
                                  <Group
                                    justify="space-between"
                                    align="center"
                                    mb="md"
                                  >
                                    <Text
                                      size="lg"
                                      fw={700}
                                      c="#105476"
                                      style={{
                                        paddingBottom: "6px",
                                      }}
                                    >
                                      ℹ️ Customer Information
                                    </Text>
                                    {user?.is_staff && (
                                      <Box style={{ width: "400px" }}>
                                        <DateRangeInput
                                          fromDate={customerDataFromDate}
                                          toDate={customerDataToDate}
                                          onFromDateChange={(date) => {
                                            setCustomerDataFromDate(date);
                                            const customerCode =
                                              customerForm.values.customer_code;
                                            if (
                                              customerCode &&
                                              date &&
                                              customerDataToDate
                                            ) {
                                              fetchCustomerData(
                                                customerCode,
                                                date,
                                                customerDataToDate
                                              );
                                            }
                                          }}
                                          onToDateChange={(date) => {
                                            setCustomerDataToDate(date);
                                            const customerCode =
                                              customerForm.values.customer_code;
                                            if (
                                              customerCode &&
                                              customerDataFromDate &&
                                              date
                                            ) {
                                              fetchCustomerData(
                                                customerCode,
                                                customerDataFromDate,
                                                date
                                              );
                                            }
                                          }}
                                          fromLabel="From"
                                          toLabel="To"
                                          size="xs"
                                          inputWidth="180px"
                                          hideLabels={false}
                                        />
                                      </Box>
                                    )}
                                  </Group>
                                  <Grid gutter="md">
                                    {/* Left Card - General Customer Info */}
                                    <Grid.Col
                                      span={{
                                        base: 12,
                                        md: user?.is_staff ? 6 : 12,
                                      }}
                                    >
                                      <Card
                                        shadow="sm"
                                        padding="lg"
                                        radius="md"
                                        withBorder
                                        style={{
                                          border: "1px solid #e9ecef",
                                          backgroundColor: "#ffffff",
                                          height: "100%",
                                        }}
                                      >
                                        <Grid gutter="md">
                                          {customerSalesperson && (
                                            <Grid.Col
                                              span={{ base: 12, sm: 6 }}
                                            >
                                              <Box>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={6}
                                                >
                                                  Salesperson
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#333"
                                                >
                                                  {customerSalesperson}
                                                </Text>
                                              </Box>
                                            </Grid.Col>
                                          )}
                                          <Grid.Col span={{ base: 12, sm: 6 }}>
                                            <Box>
                                              <Text
                                                size="xs"
                                                fw={600}
                                                c="#666"
                                                mb={6}
                                              >
                                                Credit Days
                                              </Text>
                                              <Text size="sm" fw={500} c="#333">
                                                {customerCreditDay !== null
                                                  ? `${customerCreditDay} days`
                                                  : "-"}
                                              </Text>
                                            </Box>
                                          </Grid.Col>
                                          {customerTotalCreditAmount !==
                                            null && (
                                            <Grid.Col
                                              span={{ base: 12, sm: 6 }}
                                            >
                                              <Box>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={6}
                                                >
                                                  Credit Amount
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#333"
                                                >
                                                  ₹
                                                  {customerTotalCreditAmount.toLocaleString(
                                                    "en-IN"
                                                  )}
                                                </Text>
                                              </Box>
                                            </Grid.Col>
                                          )}
                                          <Grid.Col span={{ base: 12, sm: 6 }}>
                                            <Box>
                                              <Text
                                                size="xs"
                                                fw={600}
                                                c="#666"
                                                mb={6}
                                              >
                                                Total Outstanding Amount
                                              </Text>
                                              <Text
                                                size="sm"
                                                fw={500}
                                                style={{
                                                  color:
                                                    totalOutstandingAmount > 0
                                                      ? "#28a745"
                                                      : totalOutstandingAmount <
                                                          0
                                                        ? "#dc3545"
                                                        : undefined,
                                                }}
                                              >
                                                ₹
                                                {totalOutstandingAmount.toLocaleString(
                                                  "en-IN"
                                                )}
                                              </Text>
                                            </Box>
                                          </Grid.Col>
                                          <Grid.Col span={{ base: 12, sm: 6 }}>
                                            <Box>
                                              <Text
                                                size="xs"
                                                fw={600}
                                                c="#666"
                                                mb={6}
                                              >
                                                Last Visited
                                              </Text>
                                              <Text size="sm" fw={500} c="#333">
                                                {customerLastVisited
                                                  ? dayjs(
                                                      customerLastVisited
                                                    ).format("DD/MM/YYYY")
                                                  : "-"}
                                              </Text>
                                            </Box>
                                          </Grid.Col>
                                        </Grid>
                                      </Card>
                                    </Grid.Col>

                                    {/* Right Card - Revenue/Profit with Filter - Only visible to admin users */}
                                    {user?.is_staff && (
                                      <Grid.Col span={{ base: 12, md: 6 }}>
                                        <Card
                                          shadow="sm"
                                          padding="lg"
                                          radius="md"
                                          withBorder
                                          style={{
                                            border: "1px solid #e9ecef",
                                            backgroundColor: "#ffffff",
                                            height: "100%",
                                          }}
                                        >
                                          <Stack gap="md">
                                            {/* Revenue and Profit */}
                                            <Group
                                              justify="space-evenly"
                                              mt={10}
                                            >
                                              {totalRevenue !== null && (
                                                <Box
                                                  style={{
                                                    textAlign: "center",
                                                  }}
                                                >
                                                  <Text
                                                    size="xs"
                                                    fw={600}
                                                    c="#666"
                                                    mb={6}
                                                  >
                                                    Total Revenue
                                                  </Text>
                                                  <Text
                                                    size="sm"
                                                    fw={500}
                                                    c="#FF9800"
                                                  >
                                                    ₹
                                                    {totalRevenue.toLocaleString(
                                                      "en-IN"
                                                    )}
                                                  </Text>
                                                </Box>
                                              )}
                                              {totalProfit !== null && (
                                                <Box
                                                  style={{
                                                    textAlign: "center",
                                                  }}
                                                >
                                                  <Text
                                                    size="xs"
                                                    fw={600}
                                                    c="#666"
                                                    mb={6}
                                                  >
                                                    Total Profit
                                                  </Text>
                                                  <Text
                                                    size="sm"
                                                    fw={500}
                                                    c="#105476"
                                                  >
                                                    ₹
                                                    {totalProfit.toLocaleString(
                                                      "en-IN"
                                                    )}
                                                  </Text>
                                                </Box>
                                              )}
                                            </Group>
                                          </Stack>
                                        </Card>
                                      </Grid.Col>
                                    )}
                                  </Grid>
                                </Box>
                              )}

                              {/* Quotations Section */}
                              <Box>
                                <Text
                                  size="lg"
                                  fw={700}
                                  mb="md"
                                  c="#105476"
                                  style={{
                                    paddingBottom: "6px",
                                  }}
                                >
                                  📋 Recent Quotations
                                </Text>
                                {customerQuotationData.length > 0 ? (
                                  <Grid gutter="md">
                                    {customerQuotationData.map(
                                      (quotation: QuotationData) => (
                                        <Grid.Col
                                          key={quotation.id}
                                          span={{ base: 12, sm: 6, md: 4 }}
                                        >
                                          <Card
                                            shadow="sm"
                                            padding="md"
                                            radius="md"
                                            withBorder
                                            style={{
                                              border: "1px solid #e9ecef",
                                              backgroundColor: "#ffffff",
                                              transition: "all 0.2s ease",
                                              height: "100%",
                                            }}
                                          >
                                            <Stack gap="sm">
                                              <Group
                                                justify="space-between"
                                                align="center"
                                              >
                                                <Text
                                                  size="sm"
                                                  fw={600}
                                                  c="#105476"
                                                >
                                                  {quotation.enquiry_received_date
                                                    ? dayjs(
                                                        quotation.enquiry_received_date
                                                      ).format("DD/MM/YYYY")
                                                    : "-"}
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                  {quotation.service || "-"}
                                                </Text>
                                              </Group>
                                              <Group gap="sm">
                                                <Box style={{ flex: 1 }}>
                                                  <Text
                                                    size="xs"
                                                    fw={600}
                                                    c="#666"
                                                    mb={2}
                                                  >
                                                    Origin
                                                  </Text>
                                                  <Text
                                                    size="sm"
                                                    fw={500}
                                                    c="#333"
                                                    truncate
                                                  >
                                                    {quotation.origin_name ||
                                                      "-"}
                                                  </Text>
                                                </Box>
                                                <Box style={{ flex: 1 }}>
                                                  <Text
                                                    size="xs"
                                                    fw={600}
                                                    c="#666"
                                                    mb={2}
                                                  >
                                                    Destination
                                                  </Text>
                                                  <Text
                                                    size="sm"
                                                    fw={500}
                                                    c="#333"
                                                    truncate
                                                  >
                                                    {quotation.destination_name ||
                                                      "-"}
                                                  </Text>
                                                </Box>
                                              </Group>
                                              <Group
                                                justify="space-between"
                                                align="center"
                                              >
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                >
                                                  Status:
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#28a745"
                                                >
                                                  {quotation.status || "-"}
                                                </Text>
                                              </Group>
                                            </Stack>
                                          </Card>
                                        </Grid.Col>
                                      )
                                    )}
                                  </Grid>
                                ) : (
                                  <Card
                                    shadow="sm"
                                    padding="md"
                                    radius="md"
                                    withBorder
                                    style={{ backgroundColor: "#f8f9fa" }}
                                  >
                                    <Box ta="center" py="sm">
                                      <Text c="dimmed" size="sm">
                                        No quotations found for this customer
                                      </Text>
                                    </Box>
                                  </Card>
                                )}
                              </Box>

                              {/* Shipments Section */}
                              <Box>
                                <Text
                                  size="lg"
                                  fw={700}
                                  mb="md"
                                  c="#105476"
                                  style={{
                                    paddingBottom: "6px",
                                  }}
                                >
                                  📦 Recent Shipments
                                </Text>
                                {shipmentData.length > 0 ? (
                                  <Grid gutter="md">
                                    {shipmentData.map((shipment, index) => (
                                      <Grid.Col
                                        key={index}
                                        span={{ base: 12, sm: 6, md: 4 }}
                                      >
                                        <Card
                                          shadow="sm"
                                          padding="md"
                                          radius="md"
                                          withBorder
                                          style={{
                                            border: "1px solid #e9ecef",
                                            backgroundColor: "#ffffff",
                                            height: "100%",
                                          }}
                                        >
                                          <Stack gap="sm">
                                            <Group
                                              justify="space-between"
                                              align="center"
                                            >
                                              <Text
                                                size="sm"
                                                fw={600}
                                                c="#105476"
                                              >
                                                {shipment.customer_name || "-"}
                                              </Text>
                                            </Group>
                                            <Group gap="sm">
                                              <Box style={{ flex: 1 }}>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={2}
                                                >
                                                  Booking No
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#333"
                                                >
                                                  {shipment.booking_no || "-"}
                                                </Text>
                                              </Box>
                                            </Group>
                                          </Stack>
                                        </Card>
                                      </Grid.Col>
                                    ))}
                                  </Grid>
                                ) : (
                                  <Card
                                    shadow="sm"
                                    padding="md"
                                    radius="md"
                                    withBorder
                                    style={{ backgroundColor: "#f8f9fa" }}
                                  >
                                    <Box ta="center" py="sm">
                                      <Text c="dimmed" size="sm">
                                        No shipments found for this customer
                                      </Text>
                                    </Box>
                                  </Card>
                                )}
                              </Box>

                              {/* Call Entries Section */}
                              <Box>
                                <Text
                                  size="lg"
                                  fw={700}
                                  mb="md"
                                  c="#105476"
                                  style={{
                                    paddingBottom: "6px",
                                  }}
                                >
                                  📞 Recent Call Entries
                                </Text>
                                {callEntryData.length > 0 ? (
                                  <Grid gutter="md">
                                    {callEntryData.map((callEntry) => (
                                      <Grid.Col
                                        key={callEntry.id}
                                        span={{ base: 12, sm: 6, md: 4 }}
                                      >
                                        <Card
                                          shadow="sm"
                                          padding="md"
                                          radius="md"
                                          withBorder
                                          style={{
                                            border: "1px solid #e9ecef",
                                            backgroundColor: "#ffffff",
                                            height: "100%",
                                          }}
                                        >
                                          <Stack gap="sm">
                                            <Group
                                              justify="space-between"
                                              align="center"
                                            >
                                              <Text
                                                size="sm"
                                                fw={600}
                                                c="#105476"
                                              >
                                                {callEntry.call_date
                                                  ? dayjs(
                                                      callEntry.call_date
                                                    ).format("DD/MM/YYYY")
                                                  : "-"}
                                              </Text>
                                              <Text size="xs" c="dimmed">
                                                {callEntry.call_mode || "-"}
                                              </Text>
                                            </Group>
                                            <Box>
                                              <Text
                                                size="xs"
                                                fw={600}
                                                c="#666"
                                                mb={2}
                                              >
                                                Call Summary
                                              </Text>
                                              <Text
                                                size="sm"
                                                fw={500}
                                                c="#333"
                                                style={{
                                                  display: "-webkit-box",
                                                  WebkitLineClamp: 2,
                                                  WebkitBoxOrient: "vertical",
                                                  overflow: "hidden",
                                                  lineHeight: "1.4",
                                                }}
                                              >
                                                {callEntry.call_summary || "-"}
                                              </Text>
                                            </Box>
                                          </Stack>
                                        </Card>
                                      </Grid.Col>
                                    ))}
                                  </Grid>
                                ) : (
                                  <Card
                                    shadow="sm"
                                    padding="md"
                                    radius="md"
                                    withBorder
                                    style={{ backgroundColor: "#f8f9fa" }}
                                  >
                                    <Box ta="center" py="sm">
                                      <Text c="dimmed" size="sm">
                                        No call entries found for this customer
                                      </Text>
                                    </Box>
                                  </Card>
                                )}
                              </Box>

                              {/* Potential Profiling Section */}
                              <Box>
                                <Text
                                  size="lg"
                                  fw={700}
                                  mb="md"
                                  c="#105476"
                                  style={{
                                    paddingBottom: "6px",
                                  }}
                                >
                                  🎯 Potential Profiling
                                </Text>
                                {potentialProfilingData.length > 0 ? (
                                  <Grid gutter="md">
                                    {potentialProfilingData.map((profile) => (
                                      <Grid.Col
                                        key={profile.id}
                                        span={{ base: 12, sm: 6, md: 4 }}
                                      >
                                        <Card
                                          shadow="sm"
                                          padding="md"
                                          radius="md"
                                          withBorder
                                          style={{
                                            border: "1px solid #e9ecef",
                                            backgroundColor: "#ffffff",
                                            height: "100%",
                                          }}
                                        >
                                          <Stack gap="sm">
                                            <Group
                                              justify="space-between"
                                              align="center"
                                            >
                                              <Text
                                                size="sm"
                                                fw={600}
                                                c="#105476"
                                              >
                                                {profile.service || "-"}
                                              </Text>
                                            </Group>
                                            <Group gap="sm">
                                              <Box style={{ flex: 1 }}>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={2}
                                                >
                                                  Origin
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#333"
                                                  truncate
                                                >
                                                  {profile.origin_port_name ||
                                                    "-"}
                                                </Text>
                                              </Box>
                                              <Box style={{ flex: 1 }}>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={2}
                                                >
                                                  Destination
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#333"
                                                  truncate
                                                >
                                                  {profile.destination_port_name ||
                                                    "-"}
                                                </Text>
                                              </Box>
                                            </Group>
                                            <Group gap="sm">
                                              <Box style={{ flex: 1 }}>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={2}
                                                >
                                                  No. of Shipments
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#333"
                                                >
                                                  {profile.no_of_shipments ||
                                                    "-"}
                                                </Text>
                                              </Box>
                                              <Box style={{ flex: 1 }}>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={2}
                                                >
                                                  Frequency
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#333"
                                                >
                                                  {profile.frequency_name ||
                                                    "-"}
                                                </Text>
                                              </Box>
                                            </Group>
                                            <Group gap="sm">
                                              <Box style={{ flex: 1 }}>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={2}
                                                >
                                                  Volume
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#333"
                                                >
                                                  {profile.volume || "-"}
                                                </Text>
                                              </Box>
                                              <Box style={{ flex: 1 }}>
                                                <Text
                                                  size="xs"
                                                  fw={600}
                                                  c="#666"
                                                  mb={2}
                                                >
                                                  Potential Profit
                                                </Text>
                                                <Text
                                                  size="sm"
                                                  fw={500}
                                                  c="#105476"
                                                >
                                                  ₹
                                                  {profile.potential_profit?.toLocaleString(
                                                    "en-IN"
                                                  ) || "-"}
                                                </Text>
                                              </Box>
                                            </Group>
                                          </Stack>
                                        </Card>
                                      </Grid.Col>
                                    ))}
                                  </Grid>
                                ) : (
                                  <Card
                                    shadow="sm"
                                    padding="md"
                                    radius="md"
                                    withBorder
                                    style={{ backgroundColor: "#f8f9fa" }}
                                  >
                                    <Box ta="center" py="sm">
                                      <Text c="dimmed" size="sm">
                                        No potential profiling data found for
                                        this customer
                                      </Text>
                                    </Box>
                                  </Card>
                                )}
                              </Box>
                            </Stack>
                          )}
                        </Drawer>
                      </Grid.Col>

                      <Grid.Col span={6}>
                        <Box
                          // maw={300}
                          mx="auto"
                        >
                          <DateInput
                            label="Enquiry Received Date"
                            withAsterisk
                            placeholder="YYYY-MM-DD"
                            key={customerForm.key("enquiry_received_date")}
                            value={
                              customerForm.values.enquiry_received_date
                                ? dayjs(
                                    customerForm.values.enquiry_received_date
                                  ).toDate()
                                : new Date()
                            }
                            onChange={(date) => {
                              const formatted = date
                                ? dayjs(date).format("YYYY-MM-DD")
                                : "";
                              customerForm.setFieldValue(
                                "enquiry_received_date",
                                formatted
                              );
                            }}
                            error={customerForm.errors.enquiry_received_date}
                            valueFormat="YYYY-MM-DD"
                            leftSection={<IconCalendar size={18} />}
                            leftSectionPointerEvents="none"
                            radius="sm"
                            size="sm"
                            nextIcon={<IconChevronRight size={16} />}
                            previousIcon={<IconChevronLeft size={16} />}
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
                          />
                        </Box>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Dropdown
                          label="Sales Person"
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
                          key={customerForm.key("sales_person")}
                          withAsterisk
                          placeholder="Select Salesperson"
                          searchable
                          data={salespersonsData}
                          nothingFoundMessage="No salespersons found"
                          {...customerForm.getInputProps("sales_person")}
                          onChange={(value) => {
                            customerForm.setFieldValue(
                              "sales_person",
                              value || ""
                            );

                            // Auto-fill sales coordinator and customer service based on selected sales person
                            if (value) {
                              const selectedSalesperson = salespersonsData.find(
                                (person: {
                                  value: string;
                                  sales_coordinator: string;
                                  customer_service: string;
                                }) => person.value === value
                              );
                              if (selectedSalesperson) {
                                customerForm.setFieldValue(
                                  "sales_coordinator",
                                  selectedSalesperson.sales_coordinator || ""
                                );
                                customerForm.setFieldValue(
                                  "customer_services",
                                  selectedSalesperson.customer_service || ""
                                );
                              }
                            } else {
                              // Clear fields if no salesperson selected
                              customerForm.setFieldValue(
                                "sales_coordinator",
                                ""
                              );
                              customerForm.setFieldValue(
                                "customer_services",
                                ""
                              );
                            }
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Sales Co-ordinator"
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
                          key={customerForm.key("sales_coordinator")}
                          value={customerForm.values.sales_coordinator}
                          onChange={(e) => {
                            const formattedValue = toTitleCase(e.target.value);
                            customerForm.setFieldValue(
                              "sales_coordinator",
                              formattedValue
                            );
                          }}
                          error={customerForm.errors.sales_coordinator}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Customer Service"
                          key={customerForm.key("customer_services")}
                          value={customerForm.values.customer_services}
                          onChange={(e) => {
                            const formattedValue = toTitleCase(e.target.value);
                            customerForm.setFieldValue(
                              "customer_services",
                              formattedValue
                            );
                          }}
                          error={customerForm.errors.customer_services}
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
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <TextInput
                          label="Reference No"
                          key={customerForm.key("reference_no")}
                          placeholder="Enter reference number"
                          maxLength={100}
                          {...customerForm.getInputProps("reference_no")}
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
                        />
                      </Grid.Col>
                      {/* Customer Address field is hidden in the new design */}
                      {/* <Grid.Col span={6}>
                    <TextInput
                      label="Customer Address"
                      key={customerForm.key("customer_address")}
                      placeholder="Enter Customer Address"
                      value={customerForm.values.customer_address}
                      onChange={(e) => {
                        const formattedValue = toTitleCase(e.target.value);
                        customerForm.setFieldValue(
                          "customer_address",
                          formattedValue
                        );
                      }}
                      error={customerForm.errors.customer_address}
                    />
                  </Grid.Col> */}
                    </Grid>
                  </Box>

                  {/* Buttons for Step 0 */}
                  <Box
                    style={{
                      borderTop: "1px solid #e9ecef",
                      padding: "20px 32px",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
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
                            // Restore filter state if preserved
                            const preserveFilters = (location.state as any)
                              ?.preserveFilters;
                            // Check if we came from enquiry or quotation
                            const fromEnquiry = (location.state as any)
                              ?.fromEnquiry;
                            const actionType = (location.state as any)
                              ?.actionType;

                            // Navigate to the correct list based on source
                            // If came from call entry (actionType === "createEnquiry"), go back to call entry list
                            if (actionType === "createEnquiry") {
                              // Came from call entry list, go back to call entry list
                              if (preserveFilters) {
                                navigate("/call-entry", {
                                  state: {
                                    restoreFilters: preserveFilters,
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate("/call-entry", {
                                  state: { refreshData: true },
                                });
                              }
                            } else if (fromEnquiry || actionType === "edit") {
                              // Came from enquiry list or editing enquiry, go back to enquiry list
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
                            } else {
                              // Default: navigate to quotation list (from quotation or new)
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
                            customerForm.reset();
                            setCustomerDisplayName(null);
                            setSelectedCustomerName(null);
                          }}
                        >
                          Clear all
                        </Button>
                      </Group>
                      <Group gap="sm">
                        <Button
                          variant="outline"
                          color="gray"
                          size="sm"
                          disabled={
                            !(
                              enq?.actionType === "editQuotation" ||
                              enq?.actionType === "createQuote"
                            )
                          }
                          styles={{
                            root: {
                              borderColor: "#e0e0e0",
                              color: "#999",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => {
                            // If from edit quotation or create quote flow, navigate to quotation list
                            if (
                              enq?.actionType === "editQuotation" ||
                              enq?.actionType === "createQuote"
                            ) {
                              const preserveFilters = (enq as any)
                                ?.preserveFilters;
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
                            }
                          }}
                        >
                          Back
                        </Button>
                        <Button
                          onClick={() => handleNext()}
                          size="sm"
                          style={{
                            backgroundColor: "#105476",
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          }}
                        >
                          Next
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                </>
              )}

              {active === 1 && (
                <>
                  <Box
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      // padding: "32px",
                      paddingBottom: "16px",
                      backgroundColor: "#F8F8F8",
                    }}
                  >
                    {/* Service Details Section */}

                    {/* Dynamic Service Details */}
                    <Stack gap="lg" style={{ backgroundColor: "#F8F8F8" }}>
                      {serviceForm.values.service_details.map(
                        (serviceDetail, serviceIndex) => (
                          <Box
                            key={(serviceDetail as any).id || serviceIndex}
                            style={{
                              border: "1px solid #e9ecef",
                              borderRadius: "8px",
                              padding: "24px",
                              backgroundColor: "#FFFFFF",
                            }}
                          >
                            <Flex
                              justify="space-between"
                              align="center"
                              mb="lg"
                            >
                              <Text
                                size="md"
                                fw={600}
                                c="#333"
                                style={{
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                  fontSize: "16px",
                                  color: "#22252B",
                                }}
                              >
                                {`Service ${serviceIndex + 1}`}
                              </Text>
                              {serviceForm.values.service_details.length >
                                1 && (
                                <Button
                                  variant="subtle"
                                  color="red"
                                  size="xs"
                                  p={0}
                                  styles={{
                                    root: { minWidth: "auto", height: "auto" },
                                  }}
                                  onClick={() => {
                                    serviceForm.removeListItem(
                                      "service_details",
                                      serviceIndex
                                    );
                                  }}
                                >
                                  <IconTrash size={20} color="#dc3545" />
                                </Button>
                              )}
                            </Flex>

                            <Grid>
                              <Grid.Col span={6}>
                                <Dropdown
                                  label="Service"
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
                                  searchable
                                  withAsterisk
                                  placeholder="Select Service"
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.service`
                                  )}
                                  data={["AIR", "FCL", "LCL", "OTHERS"]}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.service
                                  }
                                  onChange={(value) => {
                                    const previousService =
                                      serviceForm.values.service_details[
                                        serviceIndex
                                      ]?.service;

                                    // Set the new service value
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.service`,
                                      value || ""
                                    );

                                    // Clear service_code and service_name when service changes
                                    if (value !== "OTHERS") {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.service_code`,
                                        ""
                                      );
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.service_name`,
                                        ""
                                      );
                                    } else {
                                      // Clear trade when OTHERS is selected
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.trade`,
                                        ""
                                      );
                                    }

                                    // Reset last checked index when service changes
                                    setLastCheckedServiceIndex(null);

                                    // Check salesperson data if customer, service, and trade are all selected (only for non-OTHERS)
                                    if (value && value !== "OTHERS") {
                                      setTimeout(() => {
                                        const currentService =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.service;
                                        const currentTrade =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.trade;
                                        if (
                                          currentService &&
                                          customerForm.values.customer_code &&
                                          currentTrade
                                        ) {
                                          checkSalespersonData(serviceIndex);
                                        }
                                      }, 200);
                                    }

                                    // Clear cargo details when service changes
                                    if (previousService !== value && value) {
                                      // Reset cargo_details to default empty state
                                      const defaultCargoDetail = {
                                        no_of_packages: null,
                                        gross_weight: null,
                                        volume_weight: null,
                                        chargable_weight: null,
                                        volume: null,
                                        chargable_volume: null,
                                        container_type_code: null,
                                        no_of_containers: null,
                                        hazardous_cargo: "No",
                                        stackable: "Yes",
                                      };

                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.cargo_details`,
                                        [defaultCargoDetail]
                                      );

                                      // Reset dimensions (AIR/LCL)
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.dimension_unit`,
                                        "Centimeter"
                                      );
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.diemensions`,
                                        []
                                      );

                                      // Clear any validation errors for cargo details
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.volume_weight`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.volume`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.container_type_code`
                                      );
                                      serviceForm.clearFieldError(
                                        `service_details.${serviceIndex}.cargo_details.0.no_of_containers`
                                      );
                                    }
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.service`
                                    ] as string
                                  }
                                />
                              </Grid.Col>
                              <Grid.Col span={6}>
                                {serviceForm.values.service_details[
                                  serviceIndex
                                ]?.service === "OTHERS" ? (
                                  <Dropdown
                                    label="Service Name"
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
                                    placeholder="Select Service Name"
                                    searchable
                                    withAsterisk
                                    key={serviceForm.key(
                                      `service_details.${serviceIndex}.service_code`
                                    )}
                                    data={otherServicesData}
                                    value={
                                      serviceForm.values.service_details[
                                        serviceIndex
                                      ]?.service_code || ""
                                    }
                                    onChange={(value) => {
                                      const selectedService =
                                        otherServicesData.find(
                                          (item) => item.value === value
                                        );

                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.service_code`,
                                        value || ""
                                      );

                                      if (selectedService) {
                                        serviceForm.setFieldValue(
                                          `service_details.${serviceIndex}.service_name`,
                                          selectedService.label || ""
                                        );

                                        // Determine cargo structure based on transport_mode and full_groupage
                                        const transportMode =
                                          selectedService.transport_mode || "";
                                        const fullGroupage =
                                          selectedService.full_groupage || "";

                                        let cargoStructure = "AIR"; // Default to AIR
                                        if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "FULL"
                                        ) {
                                          cargoStructure = "FCL";
                                        } else if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "GROUPAGE"
                                        ) {
                                          cargoStructure = "LCL";
                                        }

                                        // Reset cargo_details based on determined structure
                                        if (cargoStructure === "FCL") {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.cargo_details`,
                                            [
                                              {
                                                id: null,
                                                no_of_packages: null,
                                                gross_weight: null,
                                                volume_weight: null,
                                                chargable_weight: null,
                                                volume: null,
                                                chargable_volume: null,
                                                container_type_code: null,
                                                no_of_containers: null,
                                                hazardous_cargo: "No",
                                                stackable: "Yes",
                                              },
                                            ]
                                          );
                                          // Clear dimensions for FCL
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.dimension_unit`,
                                            "Centimeter"
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.diemensions`,
                                            []
                                          );
                                        } else if (cargoStructure === "LCL") {
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.cargo_details`,
                                            [
                                              {
                                                id: null,
                                                no_of_packages: null,
                                                gross_weight: null,
                                                volume_weight: null,
                                                chargable_weight: null,
                                                volume: null,
                                                chargable_volume: null,
                                                container_type_code: null,
                                                no_of_containers: null,
                                                hazardous_cargo: "No",
                                                stackable: "Yes",
                                              },
                                            ]
                                          );
                                          // Reset dimensions for LCL
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.dimension_unit`,
                                            "Centimeter"
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.diemensions`,
                                            []
                                          );
                                        } else {
                                          // AIR structure
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.cargo_details`,
                                            [
                                              {
                                                id: null,
                                                no_of_packages: null,
                                                gross_weight: null,
                                                volume_weight: null,
                                                chargable_weight: null,
                                                volume: null,
                                                chargable_volume: null,
                                                container_type_code: null,
                                                no_of_containers: null,
                                                hazardous_cargo: "No",
                                                stackable: "Yes",
                                              },
                                            ]
                                          );
                                          // Reset dimensions for AIR
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.dimension_unit`,
                                            "Centimeter"
                                          );
                                          serviceForm.setFieldValue(
                                            `service_details.${serviceIndex}.diemensions`,
                                            []
                                          );
                                        }
                                      }
                                    }}
                                    error={
                                      serviceForm.errors[
                                        `service_details.${serviceIndex}.service_code`
                                      ] as string
                                    }
                                  />
                                ) : (
                                  <Dropdown
                                    label="Trade"
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
                                      root: {
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        color: "#424242",
                                        marginBottom: "4px",
                                        fontFamily: "Inter",
                                        fontStyle: "medium",
                                      },
                                    }}
                                    placeholder="Select Trade"
                                    searchable
                                    withAsterisk
                                    key={serviceForm.key(
                                      `service_details.${serviceIndex}.trade`
                                    )}
                                    data={["Export", "Import"]}
                                    value={
                                      serviceForm.values.service_details[
                                        serviceIndex
                                      ]?.trade
                                    }
                                    onChange={(value) => {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.trade`,
                                        value || ""
                                      );

                                      // Reset last checked index when trade changes
                                      setLastCheckedServiceIndex(null);

                                      // Check salesperson data if customer, service, and trade are all selected
                                      // Use setTimeout to ensure form value is updated
                                      setTimeout(() => {
                                        const currentService =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.service;
                                        const currentTrade =
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.trade;
                                        if (
                                          currentService &&
                                          customerForm.values.customer_code &&
                                          currentTrade
                                        ) {
                                          checkSalespersonData(serviceIndex);
                                        }
                                      }, 200);
                                    }}
                                    error={
                                      serviceForm.errors[
                                        `service_details.${serviceIndex}.trade`
                                      ] as string
                                    }
                                  />
                                )}
                              </Grid.Col>
                              <Grid.Col span={6}>
                                <SearchableSelect
                                  label="Origin"
                                  required
                                  apiEndpoint={URL.portMaster}
                                  placeholder="Type origin code or name"
                                  searchFields={["port_code", "port_name"]}
                                  displayFormat={(item: any) => ({
                                    value: String(item.port_code),
                                    label: `${item.port_name} (${item.port_code})`,
                                  })}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.origin_code
                                  }
                                  displayValue={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.origin_name
                                      ? `${serviceForm.values.service_details[serviceIndex]?.origin_name} (${serviceForm.values.service_details[serviceIndex]?.origin_code})`
                                      : serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.origin_code
                                  }
                                  onChange={(value, selectedData) => {
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.origin_code`,
                                      value || ""
                                    );
                                    if (selectedData) {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.origin_name`,
                                        selectedData.label.split(" (")[0] || ""
                                      );
                                    } else {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.origin_name`,
                                        ""
                                      );
                                    }
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.origin_code`
                                    ] as string
                                  }
                                  minSearchLength={3}
                                />
                              </Grid.Col>
                              <Grid.Col span={6}>
                                <Radio.Group
                                  label="Pickup"
                                  styles={{
                                    label: {
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      color: "#424242",
                                      marginBottom: "4px",
                                      fontFamily: "Inter",
                                      fontStyle: "medium",
                                    },
                                  }}
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.pickup`
                                  )}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.pickup`
                                  )}
                                >
                                  <Group mt={10}>
                                    <Radio
                                      value="true"
                                      label="Yes"
                                      styles={{
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
                                    <Radio
                                      value="false"
                                      label="No"
                                      styles={{
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
                                  </Group>
                                </Radio.Group>
                              </Grid.Col>

                              <Grid.Col span={6}>
                                <SearchableSelect
                                  label="Destination"
                                  required
                                  apiEndpoint={URL.portMaster}
                                  placeholder="Type destination code or name"
                                  searchFields={["port_code", "port_name"]}
                                  displayFormat={(item: any) => ({
                                    value: String(item.port_code),
                                    label: `${item.port_name} (${item.port_code})`,
                                  })}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.destination_code
                                  }
                                  displayValue={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.destination_name
                                      ? `${serviceForm.values.service_details[serviceIndex]?.destination_name} (${serviceForm.values.service_details[serviceIndex]?.destination_code})`
                                      : serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.destination_code
                                  }
                                  onChange={(value, selectedData) => {
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.destination_code`,
                                      value || ""
                                    );

                                    if (selectedData) {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.destination_name`,
                                        selectedData.label.split(" (")[0] || ""
                                      );
                                    } else {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.destination_name`,
                                        ""
                                      );
                                    }
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.destination_code`
                                    ] as string
                                  }
                                  minSearchLength={3}
                                />
                              </Grid.Col>

                              <Grid.Col span={6}>
                                <Dropdown
                                  placeholder="Select Shipment Terms"
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
                                  searchable
                                  withAsterisk
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.shipment_terms_code`
                                  )}
                                  label="Shipment Terms"
                                  data={shipmentOptions}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.shipment_terms_code`
                                  )}
                                />
                              </Grid.Col>
                              <Grid.Col span={6}>
                                <Dropdown
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.cargo_details.0.hazardous_cargo`
                                  )}
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
                                  searchable
                                  label="Hazardous Cargo"
                                  withAsterisk
                                  placeholder="Select Hazardous"
                                  data={["Yes", "No"]}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.cargo_details.0.hazardous_cargo`
                                  )}
                                />
                              </Grid.Col>
                              <Grid.Col span={6}>
                                <Radio.Group
                                  label="Delivery"
                                  styles={{
                                    label: {
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      color: "#424242",
                                      marginBottom: "4px",
                                      fontFamily: "Inter",
                                      fontStyle: "medium",
                                    },
                                  }}
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.delivery`
                                  )}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.delivery
                                  }
                                  onChange={(value) => {
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.delivery`,
                                      value
                                    );

                                    // Clear delivery_location if "false" is selected
                                    if (value === "false") {
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.delivery_location`,
                                        ""
                                      );
                                    }
                                  }}
                                >
                                  <Group mt={10}>
                                    <Radio
                                      value="true"
                                      label="Yes"
                                      styles={{
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
                                    <Radio
                                      value="false"
                                      label="No"
                                      styles={{
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
                                  </Group>
                                </Radio.Group>
                              </Grid.Col>
                              {serviceForm.values.service_details[serviceIndex]
                                ?.pickup === "true" && (
                                <Grid.Col span={6}>
                                  <TextInput
                                    label="Pickup Location"
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
                                    key={serviceForm.key(
                                      `service_details.${serviceIndex}.pickup_location`
                                    )}
                                    value={
                                      serviceForm.values.service_details[
                                        serviceIndex
                                      ]?.pickup_location || ""
                                    }
                                    onChange={(e) => {
                                      const formattedValue = toTitleCase(
                                        e.target.value
                                      );
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.pickup_location`,
                                        formattedValue
                                      );
                                    }}
                                    error={
                                      serviceForm.errors[
                                        `service_details.${serviceIndex}.pickup_location`
                                      ] as string
                                    }
                                  />
                                </Grid.Col>
                              )}
                              {serviceForm.values.service_details[serviceIndex]
                                ?.delivery === "true" && (
                                <Grid.Col span={6}>
                                  <TextInput
                                    key={serviceForm.key(
                                      `service_details.${serviceIndex}.delivery_location`
                                    )}
                                    label="Delivery Location"
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
                                    value={
                                      serviceForm.values.service_details[
                                        serviceIndex
                                      ]?.delivery_location || ""
                                    }
                                    onChange={(e) => {
                                      const formattedValue = toTitleCase(
                                        e.target.value
                                      );
                                      serviceForm.setFieldValue(
                                        `service_details.${serviceIndex}.delivery_location`,
                                        formattedValue
                                      );
                                    }}
                                    error={
                                      serviceForm.errors[
                                        `service_details.${serviceIndex}.delivery_location`
                                      ] as string
                                    }
                                  />
                                </Grid.Col>
                              )}
                              <Grid.Col span={6}>
                                <TextInput
                                  label="Service Remark"
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
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.service_remark`
                                  )}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.service_remark || ""
                                  }
                                  onChange={(e) => {
                                    const formattedValue = toTitleCase(
                                      e.target.value
                                    );
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.service_remark`,
                                      formattedValue
                                    );
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.service_remark`
                                    ] as string
                                  }
                                />
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <TextInput
                                  label="Commodity"
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
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.commodity`
                                  )}
                                  value={
                                    serviceForm.values.service_details[
                                      serviceIndex
                                    ]?.commodity || ""
                                  }
                                  onChange={(e) => {
                                    const formattedValue = toTitleCase(
                                      e.target.value
                                    );
                                    serviceForm.setFieldValue(
                                      `service_details.${serviceIndex}.commodity`,
                                      formattedValue
                                    );
                                  }}
                                  error={
                                    serviceForm.errors[
                                      `service_details.${serviceIndex}.commodity`
                                    ] as string
                                  }
                                />
                              </Grid.Col>
                              <Grid.Col span={3}>
                                <Dropdown
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
                                  key={serviceForm.key(
                                    `service_details.${serviceIndex}.cargo_details.0.stackable`
                                  )}
                                  searchable
                                  label="Stackable Cargo"
                                  withAsterisk
                                  placeholder="Select Stackable"
                                  data={["Yes", "No"]}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.cargo_details.0.stackable`
                                  )}
                                />
                              </Grid.Col>
                            </Grid>

                            {/* Cargo Details for this specific service */}
                            {serviceDetail.service &&
                              (() => {
                                // Determine effective service type for rendering (for OTHERS, determine from selected service)
                                let effectiveServiceType =
                                  serviceDetail.service;
                                if (
                                  serviceDetail.service === "OTHERS" &&
                                  serviceDetail.service_code
                                ) {
                                  const selectedOtherService =
                                    otherServicesData.find(
                                      (item) =>
                                        item.value ===
                                        serviceDetail.service_code
                                    );
                                  if (selectedOtherService) {
                                    const transportMode =
                                      selectedOtherService.transport_mode || "";
                                    const fullGroupage =
                                      selectedOtherService.full_groupage || "";
                                    if (
                                      transportMode === "SEA" &&
                                      fullGroupage === "FULL"
                                    ) {
                                      effectiveServiceType = "FCL";
                                    } else if (
                                      transportMode === "SEA" &&
                                      fullGroupage === "GROUPAGE"
                                    ) {
                                      effectiveServiceType = "LCL";
                                    } else {
                                      effectiveServiceType = "AIR";
                                    }
                                  }
                                }
                                return effectiveServiceType;
                              })() && (
                                <>
                                  <Flex
                                    align="center"
                                    justify="space-between"
                                    mt="lg"
                                    mb="md"
                                  >
                                    <Text
                                      size="md"
                                      fw={500}
                                      c="#105476"
                                      style={{
                                        paddingBottom: "4px",
                                        fontFamily: "Inter",
                                        fontStyle: "semibold",
                                        fontSize: "16px",
                                        color: "#105476",
                                      }}
                                    >
                                      Cargo Details
                                    </Text>
                                    {(() => {
                                      // Determine effective service type for rendering
                                      let effectiveServiceType =
                                        serviceDetail.service;
                                      if (
                                        serviceDetail.service === "OTHERS" &&
                                        serviceDetail.service_code
                                      ) {
                                        const selectedOtherService =
                                          otherServicesData.find(
                                            (item) =>
                                              item.value ===
                                              serviceDetail.service_code
                                          );
                                        if (selectedOtherService) {
                                          const transportMode =
                                            selectedOtherService.transport_mode ||
                                            "";
                                          const fullGroupage =
                                            selectedOtherService.full_groupage ||
                                            "";
                                          if (
                                            transportMode === "SEA" &&
                                            fullGroupage === "FULL"
                                          ) {
                                            effectiveServiceType = "FCL";
                                          } else if (
                                            transportMode === "SEA" &&
                                            fullGroupage === "GROUPAGE"
                                          ) {
                                            effectiveServiceType = "LCL";
                                          } else {
                                            effectiveServiceType = "AIR";
                                          }
                                        }
                                      }
                                      return effectiveServiceType;
                                    })() === "AIR" ||
                                    (() => {
                                      // Determine effective service type for rendering
                                      let effectiveServiceType =
                                        serviceDetail.service;
                                      if (
                                        serviceDetail.service === "OTHERS" &&
                                        serviceDetail.service_code
                                      ) {
                                        const selectedOtherService =
                                          otherServicesData.find(
                                            (item) =>
                                              item.value ===
                                              serviceDetail.service_code
                                          );
                                        if (selectedOtherService) {
                                          const transportMode =
                                            selectedOtherService.transport_mode ||
                                            "";
                                          const fullGroupage =
                                            selectedOtherService.full_groupage ||
                                            "";
                                          if (
                                            transportMode === "SEA" &&
                                            fullGroupage === "FULL"
                                          ) {
                                            effectiveServiceType = "FCL";
                                          } else if (
                                            transportMode === "SEA" &&
                                            fullGroupage === "GROUPAGE"
                                          ) {
                                            effectiveServiceType = "LCL";
                                          } else {
                                            effectiveServiceType = "AIR";
                                          }
                                        }
                                      }
                                      return effectiveServiceType;
                                    })() === "LCL" ? (
                                      <Group gap="sm">
                                        {Array.isArray(
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ]?.diemensions
                                        ) &&
                                          serviceForm.values.service_details[
                                            serviceIndex
                                          ].diemensions.length > 0 && (
                                            <Dropdown
                                              placeholder="Dimension Unit"
                                              data={
                                                DIMENSION_UNIT_OPTIONS.find(
                                                  (option) => {
                                                    // Determine effective service type for dimension unit
                                                    let effectiveServiceType =
                                                      serviceDetail.service;
                                                    if (
                                                      serviceDetail.service ===
                                                        "OTHERS" &&
                                                      serviceDetail.service_code
                                                    ) {
                                                      const selectedOtherService =
                                                        otherServicesData.find(
                                                          (item) =>
                                                            item.value ===
                                                            serviceDetail.service_code
                                                        );
                                                      if (
                                                        selectedOtherService
                                                      ) {
                                                        const transportMode =
                                                          selectedOtherService.transport_mode ||
                                                          "";
                                                        const fullGroupage =
                                                          selectedOtherService.full_groupage ||
                                                          "";
                                                        if (
                                                          transportMode ===
                                                            "SEA" &&
                                                          fullGroupage ===
                                                            "FULL"
                                                        ) {
                                                          effectiveServiceType =
                                                            "FCL";
                                                        } else if (
                                                          transportMode ===
                                                            "SEA" &&
                                                          fullGroupage ===
                                                            "GROUPAGE"
                                                        ) {
                                                          effectiveServiceType =
                                                            "LCL";
                                                        } else {
                                                          effectiveServiceType =
                                                            "AIR";
                                                        }
                                                      }
                                                    }
                                                    return (
                                                      option.service ===
                                                      effectiveServiceType
                                                    );
                                                  }
                                                )?.unit_value.map((unit) => ({
                                                  value: unit.Label,
                                                  label: unit.Label,
                                                })) || []
                                              }
                                              value={
                                                serviceForm.values
                                                  .service_details[serviceIndex]
                                                  ?.dimension_unit || ""
                                              }
                                              onChange={(value) => {
                                                serviceForm.setFieldValue(
                                                  `service_details.${serviceIndex}.dimension_unit`,
                                                  value || ""
                                                );
                                                const rows =
                                                  serviceForm.values
                                                    .service_details[
                                                    serviceIndex
                                                  ]?.diemensions || [];
                                                // Determine effective service type for dimension calculation
                                                let effectiveServiceType =
                                                  serviceDetail.service;
                                                if (
                                                  serviceDetail.service ===
                                                    "OTHERS" &&
                                                  serviceDetail.service_code
                                                ) {
                                                  const selectedOtherService =
                                                    otherServicesData.find(
                                                      (item) =>
                                                        item.value ===
                                                        serviceDetail.service_code
                                                    );
                                                  if (selectedOtherService) {
                                                    const transportMode =
                                                      selectedOtherService.transport_mode ||
                                                      "";
                                                    const fullGroupage =
                                                      selectedOtherService.full_groupage ||
                                                      "";
                                                    if (
                                                      transportMode === "SEA" &&
                                                      fullGroupage === "FULL"
                                                    ) {
                                                      effectiveServiceType =
                                                        "FCL";
                                                    } else if (
                                                      transportMode === "SEA" &&
                                                      fullGroupage ===
                                                        "GROUPAGE"
                                                    ) {
                                                      effectiveServiceType =
                                                        "LCL";
                                                    } else {
                                                      effectiveServiceType =
                                                        "AIR";
                                                    }
                                                  }
                                                }
                                                const mapped = rows.map(
                                                  (r: any) => {
                                                    const v = getDimensionValue(
                                                      effectiveServiceType,
                                                      value || ""
                                                    );
                                                    const pieces =
                                                      Number(r?.pieces) || 0;
                                                    const length =
                                                      Number(r?.length) || 0;
                                                    const width =
                                                      Number(r?.width) || 0;
                                                    const height =
                                                      Number(r?.height) || 0;
                                                    const vol = v
                                                      ? (pieces *
                                                          length *
                                                          width *
                                                          height) /
                                                        v
                                                      : 0;
                                                    return {
                                                      ...r,
                                                      value: v,
                                                      vol_weight: isFinite(vol)
                                                        ? vol
                                                        : 0,
                                                    };
                                                  }
                                                );
                                                serviceForm.setFieldValue(
                                                  `service_details.${serviceIndex}.diemensions`,
                                                  mapped
                                                );
                                              }}
                                            />
                                          )}
                                        <Button
                                          variant="light"
                                          color="#105476"
                                          leftSection={<IconPlus size={16} />}
                                          styles={{
                                            root: {
                                              fontSize: "13px",
                                              fontWeight: 500,
                                              color: "#105476",
                                              fontFamily: "Inter",
                                              fontStyle: "semibold",
                                            },
                                          }}
                                          onClick={() => {
                                            const unit =
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.dimension_unit ||
                                              "Centimeter";

                                            // Set dimension_unit to Centimeter if not already set
                                            if (
                                              !serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.dimension_unit
                                            ) {
                                              serviceForm.setFieldValue(
                                                `service_details.${serviceIndex}.dimension_unit`,
                                                "Centimeter"
                                              );
                                            }

                                            // Determine effective service type for dimension calculation
                                            let effectiveServiceType =
                                              serviceDetail.service;
                                            if (
                                              serviceDetail.service ===
                                                "OTHERS" &&
                                              serviceDetail.service_code
                                            ) {
                                              const selectedOtherService =
                                                otherServicesData.find(
                                                  (item) =>
                                                    item.value ===
                                                    serviceDetail.service_code
                                                );
                                              if (selectedOtherService) {
                                                const transportMode =
                                                  selectedOtherService.transport_mode ||
                                                  "";
                                                const fullGroupage =
                                                  selectedOtherService.full_groupage ||
                                                  "";
                                                if (
                                                  transportMode === "SEA" &&
                                                  fullGroupage === "FULL"
                                                ) {
                                                  effectiveServiceType = "FCL";
                                                } else if (
                                                  transportMode === "SEA" &&
                                                  fullGroupage === "GROUPAGE"
                                                ) {
                                                  effectiveServiceType = "LCL";
                                                } else {
                                                  effectiveServiceType = "AIR";
                                                }
                                              }
                                            }

                                            const value = getDimensionValue(
                                              effectiveServiceType,
                                              unit
                                            );
                                            const newRow = {
                                              pieces: null,
                                              length: null,
                                              width: null,
                                              height: null,
                                              value: value || null,
                                              vol_weight: null,
                                            };
                                            const list =
                                              (serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions as any[]) || [];
                                            serviceForm.setFieldValue(
                                              `service_details.${serviceIndex}.diemensions`,
                                              [...list, newRow]
                                            );
                                          }}
                                        >
                                          Add Dimension
                                        </Button>
                                      </Group>
                                    ) : null}
                                  </Flex>

                                  {/* Cargo Details Form */}
                                  {(() => {
                                    // Determine effective service type for rendering
                                    let effectiveServiceType =
                                      serviceDetail.service;
                                    if (
                                      serviceDetail.service === "OTHERS" &&
                                      serviceDetail.service_code
                                    ) {
                                      const selectedOtherService =
                                        otherServicesData.find(
                                          (item) =>
                                            item.value ===
                                            serviceDetail.service_code
                                        );
                                      if (selectedOtherService) {
                                        const transportMode =
                                          selectedOtherService.transport_mode ||
                                          "";
                                        const fullGroupage =
                                          selectedOtherService.full_groupage ||
                                          "";
                                        if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "FULL"
                                        ) {
                                          effectiveServiceType = "FCL";
                                        } else if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "GROUPAGE"
                                        ) {
                                          effectiveServiceType = "LCL";
                                        } else {
                                          effectiveServiceType = "AIR";
                                        }
                                      }
                                    }
                                    return effectiveServiceType === "AIR";
                                  })() && (
                                    <Grid>
                                      <Grid.Col span={3}>
                                        <NumberInput
                                          hideControls
                                          rightSectionPointerEvents="none"
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                          )}
                                          label="No of Packages"
                                          withAsterisk
                                          min={1}
                                          disabled={hasValidDimensions(
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.diemensions || []
                                          )}
                                          styles={
                                            hasValidDimensions(
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions || []
                                            )
                                              ? {
                                                  input: {
                                                    fontSize: "13px",
                                                    fontFamily: "Inter",
                                                    height: "36px",
                                                    backgroundColor: "#f8f9fa",
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
                                                }
                                              : {
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
                                                }
                                          }
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                          )}
                                        />
                                      </Grid.Col>
                                      {/* Dimension Unit + Add Button (AIR) */}
                                      <Grid.Col span={3}>
                                        <NumberInput
                                          hideControls
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
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                          )}
                                          label="Gross Weight (kg)"
                                          min={1}
                                          withAsterisk
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <NumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.volume_weight`
                                          )}
                                          label="Volume Weight (kg)"
                                          min={1}
                                          withAsterisk
                                          disabled={hasValidDimensions(
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.diemensions || []
                                          )}
                                          styles={
                                            hasValidDimensions(
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions || []
                                            )
                                              ? {
                                                  input: {
                                                    backgroundColor: "#f8f9fa",
                                                    cursor: "not-allowed",
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
                                                }
                                              : {
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
                                                }
                                          }
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.volume_weight`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <NumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.chargable_weight`
                                          )}
                                          label="Chargeable Weight (kg)"
                                          withAsterisk
                                          min={0}
                                          readOnly
                                          styles={{
                                            input: {
                                              cursor: "not-allowed",
                                              color: "#495057",
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
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.chargable_weight`
                                          )}
                                        />
                                        <Text
                                          size="xs"
                                          c="dimmed"
                                          mt="xs"
                                          style={{
                                            fontSize: "13px",
                                            fontFamily: "Inter",
                                            fontStyle: "medium",
                                          }}
                                        >
                                          Max of Gross Weight and Volume Weight
                                        </Text>
                                      </Grid.Col>

                                      {/* AIR Dimension Section */}
                                      {Array.isArray(
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.diemensions
                                      ) &&
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ].diemensions.length > 0 && (
                                          <>
                                            <Grid.Col span={12}>
                                              <Grid
                                                style={{
                                                  fontWeight: 600,
                                                  color: "#105476",
                                                  fontSize: "13px",
                                                  fontFamily: "Inter",
                                                  fontStyle: "medium",
                                                }}
                                              >
                                                <Grid.Col span={1.5}>
                                                  Pieces
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Length
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Width
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Height
                                                </Grid.Col>
                                                <Grid.Col span={2}>
                                                  Value
                                                </Grid.Col>
                                                <Grid.Col span={2.5}>
                                                  Volume Weight
                                                </Grid.Col>
                                                <Grid.Col span={0.8}></Grid.Col>
                                              </Grid>
                                            </Grid.Col>
                                            {serviceForm.values.service_details[
                                              serviceIndex
                                            ].diemensions.map(
                                              (row: any, rowIdx: number) => (
                                                <Grid.Col
                                                  span={12}
                                                  key={`air-dim-${serviceIndex}-${rowIdx}`}
                                                >
                                                  <Grid>
                                                    <Grid.Col span={1.5}>
                                                      <NumberInput
                                                        hideControls
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                        }}
                                                        value={
                                                          row?.pieces ?? null
                                                        }
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "AIR",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(val) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            pieces: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <NumberInput
                                                        hideControls
                                                        value={
                                                          row?.length ?? null
                                                        }
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                        }}
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "AIR",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(val) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            length: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <NumberInput
                                                        hideControls
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                        }}
                                                        value={
                                                          row?.width ?? null
                                                        }
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "AIR",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(val) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            width: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <NumberInput
                                                        hideControls
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                          },
                                                        }}
                                                        value={
                                                          row?.height ?? null
                                                        }
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "AIR",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(val) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            height: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={2}>
                                                      <NumberInput
                                                        hideControls
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                            backgroundColor:
                                                              "#f8f9fa",
                                                          },
                                                        }}
                                                        decimalScale={4}
                                                        value={
                                                          row?.value ?? null
                                                        }
                                                        readOnly
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={2.5}>
                                                      <NumberInput
                                                        hideControls
                                                        styles={{
                                                          input: {
                                                            fontSize: "13px",
                                                            fontFamily: "Inter",
                                                            height: "36px",
                                                            backgroundColor:
                                                              "#f8f9fa",
                                                          },
                                                        }}
                                                        decimalScale={4}
                                                        value={
                                                          row?.vol_weight ??
                                                          null
                                                        }
                                                        readOnly
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={0.8}>
                                                      <Button
                                                        variant="light"
                                                        color="red"
                                                        onClick={() => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          list.splice(
                                                            rowIdx,
                                                            1
                                                          );
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      >
                                                        <IconTrash size={16} />
                                                      </Button>
                                                    </Grid.Col>
                                                  </Grid>
                                                </Grid.Col>
                                              )
                                            )}
                                          </>
                                        )}
                                    </Grid>
                                  )}

                                  {(() => {
                                    // Determine effective service type for rendering
                                    let effectiveServiceType =
                                      serviceDetail.service;
                                    if (
                                      serviceDetail.service === "OTHERS" &&
                                      serviceDetail.service_code
                                    ) {
                                      const selectedOtherService =
                                        otherServicesData.find(
                                          (item) =>
                                            item.value ===
                                            serviceDetail.service_code
                                        );
                                      if (selectedOtherService) {
                                        const transportMode =
                                          selectedOtherService.transport_mode ||
                                          "";
                                        const fullGroupage =
                                          selectedOtherService.full_groupage ||
                                          "";
                                        if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "FULL"
                                        ) {
                                          effectiveServiceType = "FCL";
                                        } else if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "GROUPAGE"
                                        ) {
                                          effectiveServiceType = "LCL";
                                        } else {
                                          effectiveServiceType = "AIR";
                                        }
                                      }
                                    }
                                    return effectiveServiceType;
                                  })() === "LCL" && (
                                    <Grid>
                                      <Grid.Col span={3}>
                                        <NumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                          )}
                                          label="No of Packages"
                                          min={1}
                                          withAsterisk
                                          disabled={hasValidDimensions(
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.diemensions || []
                                          )}
                                          styles={
                                            hasValidDimensions(
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions || []
                                            )
                                              ? {
                                                  input: {
                                                    backgroundColor: "#f8f9fa",
                                                    cursor: "not-allowed",
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
                                                }
                                              : {
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
                                                }
                                          }
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.no_of_packages`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <NumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                          )}
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
                                          label="Gross Weight (kg)"
                                          min={1}
                                          withAsterisk
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.gross_weight`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <NumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.volume`
                                          )}
                                          label="Volume (cbm)"
                                          min={1}
                                          withAsterisk
                                          disabled={hasValidDimensions(
                                            serviceForm.values.service_details[
                                              serviceIndex
                                            ]?.diemensions || []
                                          )}
                                          styles={
                                            hasValidDimensions(
                                              serviceForm.values
                                                .service_details[serviceIndex]
                                                ?.diemensions || []
                                            )
                                              ? {
                                                  input: {
                                                    backgroundColor: "#f8f9fa",
                                                    cursor: "not-allowed",
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
                                                }
                                              : {
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
                                                }
                                          }
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.volume`
                                          )}
                                        />
                                      </Grid.Col>
                                      <Grid.Col span={3}>
                                        <NumberInput
                                          hideControls
                                          key={serviceForm.key(
                                            `service_details.${serviceIndex}.cargo_details.0.chargable_volume`
                                          )}
                                          label="Chargeable Volume (cbm)"
                                          min={0}
                                          readOnly
                                          styles={{
                                            input: {
                                              cursor: "not-allowed",
                                              color: "#495057",
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
                                          {...serviceForm.getInputProps(
                                            `service_details.${serviceIndex}.cargo_details.0.chargable_volume`
                                          )}
                                        />
                                        <Text
                                          size="xs"
                                          c="dimmed"
                                          mt="xs"
                                          style={{
                                            fontSize: "13px",
                                            fontFamily: "Inter",
                                            fontStyle: "medium",
                                          }}
                                        >
                                          Max of (Gross Weight ÷ 1000) and
                                          Volume
                                        </Text>
                                      </Grid.Col>
                                      {/* LCL Dimension Section */}
                                      {Array.isArray(
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ]?.diemensions
                                      ) &&
                                        serviceForm.values.service_details[
                                          serviceIndex
                                        ].diemensions.length > 0 && (
                                          <>
                                            <Grid.Col span={12}>
                                              <Grid
                                                style={{
                                                  fontWeight: 600,
                                                  color: "#105476",
                                                  fontSize: "13px",
                                                  fontFamily: "Inter",
                                                  fontStyle: "medium",
                                                }}
                                              >
                                                <Grid.Col span={1.5}>
                                                  Pieces
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Length
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Width
                                                </Grid.Col>
                                                <Grid.Col span={1.5}>
                                                  Height
                                                </Grid.Col>
                                                <Grid.Col span={2}>
                                                  Value
                                                </Grid.Col>
                                                <Grid.Col span={2.5}>
                                                  Volume Weight
                                                </Grid.Col>
                                                <Grid.Col span={0.8}></Grid.Col>
                                              </Grid>
                                            </Grid.Col>
                                            {serviceForm.values.service_details[
                                              serviceIndex
                                            ].diemensions.map(
                                              (row: any, rowIdx: number) => (
                                                <Grid.Col
                                                  span={12}
                                                  key={`lcl-dim-${serviceIndex}-${rowIdx}`}
                                                >
                                                  <Grid>
                                                    <Grid.Col span={1.5}>
                                                      <NumberInput
                                                        hideControls
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
                                                        value={
                                                          row?.pieces ?? null
                                                        }
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "LCL",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(val) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            pieces: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <NumberInput
                                                        hideControls
                                                        value={
                                                          row?.length ?? null
                                                        }
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
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "LCL",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(val) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            length: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <NumberInput
                                                        hideControls
                                                        value={
                                                          row?.width ?? null
                                                        }
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
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "LCL",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(val) || 0;
                                                          const height =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.height
                                                            ) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            width: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={1.5}>
                                                      <NumberInput
                                                        hideControls
                                                        value={
                                                          row?.height ?? null
                                                        }
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
                                                        onChange={(val) => {
                                                          const list = [
                                                            ...((serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ]
                                                              .diemensions as any[]) ||
                                                              []),
                                                          ];
                                                          const v =
                                                            getDimensionValue(
                                                              "LCL",
                                                              serviceForm.values
                                                                .service_details[
                                                                serviceIndex
                                                              ]
                                                                ?.dimension_unit ||
                                                                ""
                                                            );
                                                          const pieces =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.pieces
                                                            ) || 0;
                                                          const length =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.length
                                                            ) || 0;
                                                          const width =
                                                            Number(
                                                              list[rowIdx]
                                                                ?.width
                                                            ) || 0;
                                                          const height =
                                                            Number(val) || 0;
                                                          const vol = v
                                                            ? (pieces *
                                                                length *
                                                                width *
                                                                height) /
                                                              v
                                                            : 0;
                                                          list[rowIdx] = {
                                                            ...(list[rowIdx] ||
                                                              {}),
                                                            height: val,
                                                            value: v || null,
                                                            vol_weight:
                                                              isFinite(vol)
                                                                ? vol
                                                                : null,
                                                          };
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={2}>
                                                      <NumberInput
                                                        hideControls
                                                        decimalScale={4}
                                                        value={
                                                          row?.value ?? null
                                                        }
                                                        readOnly
                                                        styles={{
                                                          input: {
                                                            backgroundColor:
                                                              "#f8f9fa",
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
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={2.5}>
                                                      <NumberInput
                                                        hideControls
                                                        decimalScale={4}
                                                        value={
                                                          row?.vol_weight ??
                                                          null
                                                        }
                                                        readOnly
                                                        styles={{
                                                          input: {
                                                            backgroundColor:
                                                              "#f8f9fa",
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
                                                      />
                                                    </Grid.Col>
                                                    <Grid.Col span={0.8}>
                                                      <Button
                                                        variant="light"
                                                        color="red"
                                                        onClick={() => {
                                                          const list = [
                                                            ...(serviceForm
                                                              .values
                                                              .service_details[
                                                              serviceIndex
                                                            ].diemensions ||
                                                              []),
                                                          ];
                                                          list.splice(
                                                            rowIdx,
                                                            1
                                                          );
                                                          serviceForm.setFieldValue(
                                                            `service_details.${serviceIndex}.diemensions`,
                                                            list
                                                          );
                                                        }}
                                                      >
                                                        <IconTrash size={16} />
                                                      </Button>
                                                    </Grid.Col>
                                                  </Grid>
                                                </Grid.Col>
                                              )
                                            )}
                                          </>
                                        )}
                                    </Grid>
                                  )}

                                  {(() => {
                                    // Determine effective service type for rendering
                                    let effectiveServiceType =
                                      serviceDetail.service;
                                    if (
                                      serviceDetail.service === "OTHERS" &&
                                      serviceDetail.service_code
                                    ) {
                                      const selectedOtherService =
                                        otherServicesData.find(
                                          (item) =>
                                            item.value ===
                                            serviceDetail.service_code
                                        );
                                      if (selectedOtherService) {
                                        const transportMode =
                                          selectedOtherService.transport_mode ||
                                          "";
                                        const fullGroupage =
                                          selectedOtherService.full_groupage ||
                                          "";
                                        if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "FULL"
                                        ) {
                                          effectiveServiceType = "FCL";
                                        } else if (
                                          transportMode === "SEA" &&
                                          fullGroupage === "GROUPAGE"
                                        ) {
                                          effectiveServiceType = "LCL";
                                        } else {
                                          effectiveServiceType = "AIR";
                                        }
                                      }
                                    }
                                    return effectiveServiceType;
                                  })() === "FCL" && (
                                    <Stack gap="md">
                                      {/* Show cargo details for this specific service - use current form values */}
                                      {serviceForm.values.service_details[
                                        serviceIndex
                                      ].cargo_details.map(
                                        (cargoDetail, cargoIndex) => (
                                          <Box
                                            key={`${(serviceDetail as any).id || serviceIndex}-cargo-${cargoDetail.id || cargoIndex}`}
                                          >
                                            <Grid>
                                              <Grid.Col span={3}>
                                                <Dropdown
                                                  key={serviceForm.key(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`
                                                  )}
                                                  searchable
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
                                                  label="Container Type"
                                                  placeholder="Select Container Type"
                                                  withAsterisk
                                                  data={containerTypeData}
                                                  nothingFoundMessage="No container types found"
                                                  {...serviceForm.getInputProps(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`
                                                  )}
                                                />
                                              </Grid.Col>
                                              <Grid.Col span={3}>
                                                <NumberInput
                                                  hideControls
                                                  key={serviceForm.key(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`
                                                  )}
                                                  label="No of Containers"
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
                                                  placeholder="Enter number of containers"
                                                  min={1}
                                                  withAsterisk
                                                  {...serviceForm.getInputProps(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`
                                                  )}
                                                />
                                              </Grid.Col>
                                              <Grid.Col span={3}>
                                                <NumberInput
                                                  hideControls
                                                  key={serviceForm.key(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`
                                                  )}
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
                                                  label="Gross Weight (kg)"
                                                  withAsterisk
                                                  placeholder="Enter gross weight"
                                                  min={0}
                                                  {...serviceForm.getInputProps(
                                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`
                                                  )}
                                                />
                                              </Grid.Col>
                                              {/* Add button only on the last cargo detail */}
                                              {cargoIndex ===
                                                serviceForm.values
                                                  .service_details[serviceIndex]
                                                  .cargo_details.length -
                                                  1 && (
                                                <Grid.Col span={0.75}>
                                                  <Button
                                                    variant="light"
                                                    color="#105476"
                                                    mt={25}
                                                    onClick={() =>
                                                      serviceForm.insertListItem(
                                                        `service_details.${serviceIndex}.cargo_details`,
                                                        {
                                                          id: null,
                                                          no_of_packages: null,
                                                          gross_weight: null,
                                                          volume_weight: null,
                                                          chargable_weight:
                                                            null,
                                                          volume: null,
                                                          chargable_volume:
                                                            null,
                                                          container_type_code:
                                                            null,
                                                          no_of_containers:
                                                            null,
                                                          hazardous_cargo: "No",
                                                          stackable: "Yes",
                                                        }
                                                      )
                                                    }
                                                  >
                                                    <IconPlus size={16} />
                                                  </Button>
                                                </Grid.Col>
                                              )}
                                              {/* Remove button */}
                                              <Grid.Col span={0.75}>
                                                {serviceForm.values
                                                  .service_details[serviceIndex]
                                                  .cargo_details.length > 1 ? (
                                                  <Button
                                                    variant="light"
                                                    color="red"
                                                    mt={25}
                                                    onClick={() => {
                                                      // Use cargoIndex directly - it's the correct index at render time
                                                      serviceForm.removeListItem(
                                                        `service_details.${serviceIndex}.cargo_details`,
                                                        cargoIndex
                                                      );
                                                    }}
                                                  >
                                                    <IconTrash size={16} />
                                                  </Button>
                                                ) : (
                                                  ""
                                                )}
                                              </Grid.Col>
                                            </Grid>
                                          </Box>
                                        )
                                      )}
                                    </Stack>
                                  )}
                                </>
                              )}
                          </Box>
                        )
                      )}
                    </Stack>
                    <Flex justify="end" align="center" mb="md" mt="md">
                      <Button
                        variant="subtle"
                        color="#105476"
                        size="sm"
                        leftSection={<IconPlus size={16} />}
                        styles={{
                          root: {
                            color: "#105476",
                            fontWeight: 500,
                            fontSize: "13px",
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                          label: {
                            fontSize: "13px",
                            fontWeight: 500,
                            fontFamily: "Inter",
                            fontStyle: "medium",
                          },
                        }}
                        onClick={() =>
                          serviceForm.insertListItem("service_details", {
                            id: "",
                            service: "",
                            trade: "",
                            service_code: "",
                            service_name: "",
                            origin_code: "",
                            origin_name: "",
                            destination_code: "",
                            destination_name: "",
                            pickup: "false",
                            delivery: "false",
                            pickup_location: "",
                            delivery_location: "",
                            shipment_terms_code: "",
                            dimension_unit: "Centimeter",
                            diemensions: [],
                            cargo_details: [
                              {
                                id: null,
                                no_of_packages: null,
                                gross_weight: null,
                                volume_weight: null,
                                chargable_weight: null,
                                volume: null,
                                chargable_volume: null,
                                container_type_code: null,
                                no_of_containers: null,
                                hazardous_cargo: "No",
                                stackable: "Yes",
                              },
                            ],
                          })
                        }
                      >
                        Add Service
                      </Button>
                    </Flex>
                  </Box>

                  {/* Buttons for Step 1 */}
                  <Box
                    style={{
                      borderTop: "1px solid #e9ecef",
                      padding: "20px 32px",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
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
                            // Restore filter state if preserved
                            const preserveFilters = (location.state as any)
                              ?.preserveFilters;
                            // Check if we came from enquiry or quotation
                            const fromEnquiry = (location.state as any)
                              ?.fromEnquiry;
                            const actionType = (location.state as any)
                              ?.actionType;

                            // Navigate to the correct list based on source
                            // If came from call entry (actionType === "createEnquiry"), go back to call entry list
                            if (actionType === "createEnquiry") {
                              // Came from call entry list, go back to call entry list
                              if (preserveFilters) {
                                navigate("/call-entry", {
                                  state: {
                                    restoreFilters: preserveFilters,
                                    refreshData: true,
                                  },
                                });
                              } else {
                                navigate("/call-entry", {
                                  state: { refreshData: true },
                                });
                              }
                            } else if (fromEnquiry || actionType === "edit") {
                              // Came from enquiry list or editing enquiry, go back to enquiry list
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
                            } else {
                              // Default: navigate to quotation list (from quotation or new)
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
                            serviceForm.reset();
                          }}
                        >
                          Clear all
                        </Button>
                      </Group>

                      <Group gap="sm">
                        <Button
                          variant="outline"
                          size="sm"
                          styles={{
                            root: {
                              borderColor: "#105476",
                              color: "#666",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            },
                          }}
                          onClick={() => {
                            if (
                              customerForm.values.supporting_documents
                                .length === 0
                            ) {
                              customerForm.setFieldValue(
                                "supporting_documents",
                                [{ name: "", file: null }]
                              );
                            }
                            // Validate all existing files for size
                            const newErrors: { [key: number]: string } = {};
                            customerForm.values.supporting_documents.forEach(
                              (doc, idx) => {
                                if (doc.file && doc.file.size > MAX_FILE_SIZE) {
                                  newErrors[idx] =
                                    `File size exceeds 5MB limit. Current size: ${(doc.file.size / (1024 * 1024)).toFixed(2)}MB`;
                                }
                              }
                            );
                            setFileErrors(newErrors);
                            openDocumentsModal();
                          }}
                          disabled={isSubmitting}
                        >
                          Attach supporting document
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
                          onClick={() => setActive((current) => current - 1)}
                        >
                          Back
                        </Button>

                        {/* Show Next button for edit/create quotation flow, Submit button otherwise */}
                        {enq?.actionType === "editQuotation" ||
                        enq?.actionType === "createQuote" ? (
                          <>
                            <Button
                              onClick={() => {
                                // Validate service form before navigating to quotation
                                const serviceFormResult =
                                  serviceForm.validate();
                                if (!serviceFormResult.hasErrors) {
                                  setActive(2); // Navigate to quotation step
                                }
                              }}
                              size="sm"
                              style={{
                                backgroundColor: "#105476",
                                fontSize: "13px",
                                fontFamily: "Inter",
                                fontStyle: "medium",
                              }}
                            >
                              Next
                            </Button>
                            {/* Show Submit button for create quote flow to allow saving enquiry */}
                            {enq?.actionType === "createQuote" && (
                              <Button
                                rightSection={
                                  isSubmitting ? (
                                    <Loader size={16} color="white" />
                                  ) : null
                                }
                                onClick={() => handleNext()}
                                size="sm"
                                style={{
                                  backgroundColor: "#105476",
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  fontStyle: "medium",
                                }}
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? "Submitting..." : "Submit"}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            rightSection={
                              isSubmitting ? (
                                <Loader size={16} color="white" />
                              ) : null
                            }
                            onClick={() => handleNext()}
                            size="sm"
                            style={{
                              backgroundColor: "#105476",
                              fontSize: "13px",
                              fontFamily: "Inter",
                              fontStyle: "medium",
                            }}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "Submitting..." : "Submit"}
                          </Button>
                        )}
                      </Group>
                    </Group>
                  </Box>
                </>
              )}

              {showQuotation && active === 2 && (
                <Box
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    backgroundColor: "#F8F8F8",
                    minHeight: 0,
                  }}
                >
                  <QuotationCreate
                    enquiryData={{
                      ...enq,
                      // Override with current form values
                      customer_code: customerForm.values.customer_code,
                      customer_name: customerDisplayName || "",
                      enquiry_received_date:
                        customerForm.values.enquiry_received_date,
                      sales_person: customerForm.values.sales_person,
                      sales_coordinator: customerForm.values.sales_coordinator,
                      customer_services: customerForm.values.customer_services,
                      // Pass current service form values
                      services: serviceForm.values.service_details.map(
                        (service: any) => ({
                          ...service,
                          origin_code_read: service.origin_code,
                          destination_code_read: service.destination_code,
                          shipment_terms_code_read: service.shipment_terms_code,
                        })
                      ),
                      // Pass quotation data if available (for edit quotation flow)
                      quotation: enq?.quotation,
                    }}
                    goToStep={setActive}
                  />
                </Box>
              )}
            </Box>
          </Flex>
        </Box>

        {/* Supporting Documents Modal */}
        <Modal
          opened={documentsModalOpened}
          onClose={closeDocumentsModal}
          title="Attach Supporting Documents"
          size="xl"
          centered
          style={{
            fontFamily: "Inter",
            fontStyle: "medium",
          }}
        >
          <Stack gap="xs">
            {customerForm.values.supporting_documents.map((doc, index) => (
              <Grid key={index} columns={12} gutter="sm" align="flex-end">
                <Grid.Col span={5.5}>
                  <TextInput
                    label="Document Name"
                    placeholder="Enter document name"
                    value={doc.name}
                    onChange={(e) => {
                      const updatedDocs = [
                        ...customerForm.values.supporting_documents,
                      ];
                      updatedDocs[index] = {
                        ...updatedDocs[index],
                        name: e.target.value,
                      };
                      customerForm.setFieldValue(
                        "supporting_documents",
                        updatedDocs
                      );
                    }}
                  />
                </Grid.Col>
                <Grid.Col span={5.5}>
                  <Box>
                    <Text size="sm" fw={500} mb={4}>
                      File
                    </Text>
                    <Dropzone
                      onDrop={(files: File[]) => {
                        if (files.length === 0) return;
                        const file = files[0]; // Take first file only

                        // Clear previous error for this index
                        if (fileErrors[index]) {
                          const newErrors = { ...fileErrors };
                          delete newErrors[index];
                          setFileErrors(newErrors);
                        }

                        // Validate file size
                        if (file.size > MAX_FILE_SIZE) {
                          const newErrors = { ...fileErrors };
                          newErrors[index] =
                            `File size exceeds 5MB limit. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
                          setFileErrors(newErrors);
                          ToastNotification({
                            type: "error",
                            message: `File "${file.name}" exceeds 5MB limit`,
                          });
                          return;
                        }

                        const updatedDocs = [
                          ...customerForm.values.supporting_documents,
                        ];
                        updatedDocs[index] = {
                          ...updatedDocs[index],
                          file: file,
                          document_url: undefined, // Clear existing file URL when new file is uploaded
                          document_id: undefined, // Clear existing document ID when new file is uploaded
                        };
                        customerForm.setFieldValue(
                          "supporting_documents",
                          updatedDocs
                        );
                      }}
                      onReject={(files: any[]) => {
                        const rejection = files[0];
                        if (
                          rejection?.errors?.some(
                            (e: any) => e.code === "file-too-large"
                          )
                        ) {
                          const newErrors = { ...fileErrors };
                          newErrors[index] = "File size exceeds 5MB limit";
                          setFileErrors(newErrors);
                        }
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
                          "&:hover": {
                            borderColor: "var(--mantine-color-gray-5)",
                          },
                          "&[data-accept]": {
                            borderColor: "var(--mantine-color-blue-6)",
                            backgroundColor: "var(--mantine-color-blue-0)",
                          },
                          "&[data-reject]": {
                            borderColor: "var(--mantine-color-red-6)",
                            backgroundColor: "var(--mantine-color-red-0)",
                          },
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
                          {doc.file ? (
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
                                {doc.file.name}
                              </Text>
                            </>
                          ) : doc.document_url ? (
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
                                  pointerEvents: "auto",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    doc.document_url &&
                                    doc.original_document_name
                                  ) {
                                    downloadFile(
                                      doc.document_url,
                                      doc.original_document_name
                                    );
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = "0.8";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = "1";
                                }}
                              >
                                {doc.original_document_name || "Download file"}
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
                        {(doc.file || doc.document_url) && (
                          <Button
                            variant="subtle"
                            color="red"
                            size="xs"
                            p={4}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Clear error for this index
                              if (fileErrors[index]) {
                                const newErrors = { ...fileErrors };
                                delete newErrors[index];
                                setFileErrors(newErrors);
                              }

                              const updatedDocs = [
                                ...customerForm.values.supporting_documents,
                              ];
                              updatedDocs[index] = {
                                ...updatedDocs[index],
                                file: null,
                                document_url: undefined,
                                document_id: undefined,
                              };
                              customerForm.setFieldValue(
                                "supporting_documents",
                                updatedDocs
                              );
                            }}
                            style={{ pointerEvents: "auto" }}
                          >
                            <IconX size={14} />
                          </Button>
                        )}
                      </Group>
                    </Dropzone>
                    {fileErrors[index] && (
                      <Text size="xs" c="red" mt={4}>
                        {fileErrors[index]}
                      </Text>
                    )}
                  </Box>
                </Grid.Col>
                <Grid.Col span={1}>
                  <Button
                    variant="light"
                    color="red"
                    onClick={() => {
                      // Clear error for this index
                      if (fileErrors[index]) {
                        const newErrors = { ...fileErrors };
                        delete newErrors[index];
                        setFileErrors(newErrors);
                      }

                      if (
                        customerForm.values.supporting_documents.length === 1
                      ) {
                        // If only one row, clear it instead of removing
                        customerForm.setFieldValue("supporting_documents", [
                          { name: "", file: null },
                        ]);
                      } else {
                        // Remove the row and reindex errors
                        const updatedDocs =
                          customerForm.values.supporting_documents.filter(
                            (_, i) => i !== index
                          );
                        customerForm.setFieldValue(
                          "supporting_documents",
                          updatedDocs
                        );
                        // Reindex errors after deletion
                        const newErrors: { [key: number]: string } = {};
                        Object.keys(fileErrors).forEach((key) => {
                          const keyNum = parseInt(key);
                          if (keyNum < index) {
                            newErrors[keyNum] = fileErrors[keyNum];
                          } else if (keyNum > index) {
                            newErrors[keyNum - 1] = fileErrors[keyNum];
                          }
                        });
                        setFileErrors(newErrors);
                      }
                    }}
                  >
                    <IconTrash size={16} />
                  </Button>
                </Grid.Col>
                <Grid.Col span={1} offset={11}>
                  {index ===
                    customerForm.values.supporting_documents.length - 1 && (
                    <Button
                      variant="light"
                      color="#105476"
                      onClick={() => {
                        customerForm.setFieldValue("supporting_documents", [
                          ...customerForm.values.supporting_documents,
                          { name: "", file: null },
                        ]);
                      }}
                    >
                      <IconPlus size={16} />
                    </Button>
                  )}
                </Grid.Col>
              </Grid>
            ))}

            {customerForm.values.supporting_documents.length === 0 && (
              <Button
                variant="light"
                color="#105476"
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  customerForm.setFieldValue("supporting_documents", [
                    { name: "", file: null },
                  ]);
                }}
                fullWidth
              >
                Add Document
              </Button>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={closeDocumentsModal}>
                Close
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Chatbot is now global and available on all pages */}
      </Box>

      {/* Salesperson Confirmation Modal */}
      <Modal
        opened={salespersonModalOpened}
        onClose={closeSalespersonModal}
        title="Update Salesperson Information"
        centered
        size="lg"
        styles={{
          title: {
            fontWeight: 700,
            fontSize: 20,
            color: "#105476",
          },
        }}
      >
        <Stack gap="md">
          <Text
            size="sm"
            fw={400}
            c="gray"
            style={{
              fontSize: "13px",
              fontFamily: "Inter",
              fontStyle: "medium",
            }}
          >
            The selected service and trade combination has a different
            salesperson assigned. Would you like to update the form with the
            following information?
          </Text>

          {salespersonModalData && (
            <Box>
              <Grid>
                <Grid.Col span={4} px={20}>
                  <Text size="md" fw={600} c="#105476" mb={4}>
                    Sales Person
                  </Text>
                  <Text size="sm" fw={500} mb="md">
                    {salespersonModalData.sales_person || "-"}
                  </Text>
                </Grid.Col>
                <Grid.Col span={4} px={20}>
                  <Text size="md" fw={600} c="#105476" mb={4}>
                    Sales Coordinator
                  </Text>
                  <Text
                    size="sm"
                    fw={500}
                    px={salespersonModalData.sales_coordinator ? 0 : 2}
                    mb="md"
                  >
                    {salespersonModalData.sales_coordinator || "-"}
                  </Text>
                </Grid.Col>
                <Grid.Col span={4} px={20}>
                  <Text size="md" fw={600} c="#105476" mb={4}>
                    Customer Service
                  </Text>
                  <Text
                    size="sm"
                    fw={500}
                    px={salespersonModalData.customer_service ? 0 : 2}
                    mb="md"
                  >
                    {salespersonModalData.customer_service || "-"}
                  </Text>
                </Grid.Col>
              </Grid>
            </Box>
          )}

          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={closeSalespersonModal}
              styles={{
                root: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontStyle: "medium",
                },
                label: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontStyle: "medium",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              color="#105476"
              onClick={handleUpdateSalespersonData}
              styles={{
                root: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontStyle: "medium",
                },
                label: {
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontStyle: "medium",
                },
              }}
            >
              Yes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default EnquiryCreate;
