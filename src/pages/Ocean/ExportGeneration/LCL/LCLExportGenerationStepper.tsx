import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Group,
  Stepper,
  Text,
  Grid,
  TextInput,
  NumberInput,
  Stack,
  Radio,
  Divider,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import {
  IconArrowLeft,
  IconCheck,
  IconCalendar,
  IconPlus,
  IconTrash,
  IconChevronRight,
  IconChevronLeft,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { postAPICall } from "../../../../service/postApiCall";
import { putAPICall } from "../../../../service/putApiCall";
import { Dropdown, ToastNotification } from "../../../../components";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../../api/serverUrls";
import { API_HEADER } from "../../../../store/storeKeys";
import { getAPICall } from "../../../../service/getApiCall";
import { SearchableSelect } from "../../../../components";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import useAuthStore from "../../../../store/authStore";
import { useDebouncedCallback } from "@mantine/hooks";
import { toTitleCase } from "../../../../utils/textFormatter";

interface ExportShipmentStepperProps {
  onStepChange?: (step: number) => void;
  onComplete?: () => void;
  initialData?: Record<string, unknown>;
  isEditMode?: boolean;
}

interface RoutingDetail {
  move_type: string;
  from_location_code: string;
  to_location_code: string;
  etd: Date;
  eta: Date;
  carrier_code: string;
  flight_no: string | null;
  status: string;
}

interface CargoDetail {
  // Common fields
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

interface FormValues {
  // Export Shipment fields
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

  // Ocean Schedule fields
  schedule_id: string;
  carrier_code: string;
  carrier_name: string;
  eta: Date;
  etd: Date;
  vessel_name: string;
  voyage_no: string;

  // Routing Details
  routingDetails: RoutingDetail[];

  // Party Details fields
  shipper_code: string;
  shipper_address_id: number;
  shipper_email: string;
  consignee_code: string;
  consignee_address_id: number;
  consignee_email: string;
  forwarder_code: string;
  forwarder_address_id: number;
  forwarder_email: string;
  destination_agent_code: string;
  destination_agent_address_id: number;
  destination_agent_email: string;
  billing_customer_code: string;
  billing_customer_address_id: number;
  notify_customer_code: string;
  notify_customer_address_id: number;
  notify_customer_email: string;
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
  transporter_name: string;
  transporter_email: string;

  // Delivery Details
  delivery_location: string;
  delivery_from_code: string;
  delivery_address_id: string;
  planned_delivery_date: Date;
}

// Yup validation schema
const validationSchema = yup.object({
  // Export Shipment fields - Only these are required
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

  // Ocean Schedule fields - All optional
  schedule_id: yup.string(),
  carrier_code: yup.string(),
  eta: yup.date(),
  etd: yup.date(),
  vessel_name: yup.string(),
  voyage_no: yup.string(),

  // Routing Details - All optional
  routingDetails: yup.array().of(
    yup.object({
      move_type: yup.string(),
      from_location_code: yup.string(),
      to_location_code: yup.string(),
      etd: yup.date(),
      eta: yup.date(),
      carrier_code: yup.string(),
      flight_no: yup.string().nullable(),
      status: yup.string(),
    })
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
    })
  ),

  // Pickup Details - All optional
  pickup_location: yup.string(),
  pickup_from_code: yup.string(),
  pickup_address_id: yup.string(),
  planned_pickup_date: yup.date(),
  transporter_name: yup.string(),
  transporter_email: yup.string().email("Invalid email format"),

  // Delivery Details - All optional
  delivery_location: yup.string(),
  delivery_from_code: yup.string(),
  delivery_address_id: yup.string(),
  planned_delivery_date: yup.date(),
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

const LCLExportGenerationStepper: React.FC<ExportShipmentStepperProps> = ({
  onStepChange,
  onComplete,
  initialData,
  isEditMode = false,
}) => {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [charges, setCharges] = useState([
    {
      id: 1,
      charge_name: "",
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
  const [shipperDisplayName, setShipperDisplayName] = useState<string | null>(
    null
  );
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

  // State for routing details display values
  const [routingDisplayNames, setRoutingDisplayNames] = useState<
    Array<{
      from: string | null;
      to: string | null;
      carrier: string | null;
    }>
  >([{ from: null, to: null, carrier: null }]);

  // State for address options
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [agentAddressOptions, setAgentAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [shipperAddressOptions, setShipperAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [forwarderAddressOptions, setForwarderAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [chaAddressOptions, setChaAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [billingCustomerAddressOptions, setBillingCustomerAddressOptions] =
    useState<Array<{ value: string; label: string }>>([]);
  const [notifyCustomerAddressOptions, setNotifyCustomerAddressOptions] =
    useState<Array<{ value: string; label: string }>>([]);

  // Auto-set service to LCL on mount
  useEffect(() => {
    if (!initialData || !initialData.service) {
      form.setFieldValue("service", "LCL");
    }
  }, []);

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

  // Get user data from auth store
  const user = useAuthStore((state) => state.user);

  // Type for terms of shipment data
  type TermsOfShipmentData = {
    tos_code: string;
    tos_name: string;
  };

  // Memoized shipment options
  const shipmentOptions = useMemo(() => {
    if (!Array.isArray(termsOfShipment) || !termsOfShipment.length) return [];
    return termsOfShipment.map((item: TermsOfShipmentData) => ({
      value: item.tos_code ? String(item.tos_code) : "",
      label: `${item.tos_name} (${item.tos_code})`,
    }));
  }, [termsOfShipment]);

  // Memoized container type options
  const containerTypeOptions = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];
    return rawContainerData.map((item: Record<string, unknown>) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: String(item.container_name || ""),
    }));
  }, [rawContainerData]);

  const updateCharge = (id: number, field: string, value: string) => {
    setCharges(
      charges.map((charge) => {
        if (charge.id === id) {
          const updatedCharge = { ...charge, [field]: value };

          // Calculate totals when relevant fields change
          if (
            field === "no_of_units" ||
            field === "sell_per_unit" ||
            field === "roe"
          ) {
            const noOfUnits = parseFloat(updatedCharge.no_of_units) || 0;
            const sellPerUnit = parseFloat(updatedCharge.sell_per_unit) || 0;
            const roe = parseFloat(updatedCharge.roe) || 1;

            updatedCharge.total_sell = (noOfUnits * sellPerUnit * roe).toFixed(
              2
            );
          }

          if (field === "no_of_units" || field === "cost_per_unit") {
            const noOfUnits = parseFloat(updatedCharge.no_of_units) || 0;
            const costPerUnit = parseFloat(updatedCharge.cost_per_unit) || 0;

            updatedCharge.total_cost = (noOfUnits * costPerUnit).toFixed(2);
          }

          return updatedCharge;
        }
        return charge;
      })
    );
  };

  const addNewCharge = () => {
    const newCharge = {
      id: charges.length + 1,
      charge_name: "",
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

  const removeCharge = (id: number) => {
    if (charges.length > 1) {
      setCharges(charges.filter((charge) => charge.id !== id));
    }
  };

  // Function to map initial data to form values
  const mapInitialDataToFormValues = (
    data: Record<string, unknown>
  ): Partial<FormValues> => {
    if (!data) return {};

    return {
      // Export Shipment fields
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

      // Ocean Schedule fields
      schedule_id: String(data.schedule_id || ""),
      carrier_code: String(data.carrier_code || ""),
      carrier_name: String(data.carrier_name || ""),
      eta: data.eta ? new Date(String(data.eta)) : new Date(),
      etd: data.etd ? new Date(String(data.etd)) : new Date(),
      vessel_name: String(data.vessel_name || ""),
      voyage_no: String(data.voyage_no || ""),

      // Routing Details - map from routing_details array
      routingDetails: data.routing_details
        ? (data.routing_details as Array<Record<string, unknown>>).map(
            (route: Record<string, unknown>) => ({
              move_type: String(route.move_type || ""),
              from_location_code: "",
              to_location_code: "",
              etd: route.etd ? new Date(String(route.etd)) : new Date(),
              eta: route.eta ? new Date(String(route.eta)) : new Date(),
              carrier_code: "",
              flight_no: route.flight_no ? String(route.flight_no) : null,
              status: String(route.status || ""),
            })
          )
        : [],

      // Party Details fields - map from the provided data structure
      shipper_code: String(data.shipper_code || ""),
      shipper_address_id: Number(data.shipper_address_id) || 0,
      shipper_email: String(data.shipper_email || ""),
      consignee_code: String(data.consignee_code || ""),
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
            })
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
      transporter_name: String(data.transporter_name || ""),
      transporter_email: String(data.transporter_email || ""),

      // Delivery Details
      delivery_location: String(data.delivery_location || ""),
      delivery_from_code: String(data.delivery_from_code || ""),
      delivery_address_id: String(data.delivery_address_id || ""),
      planned_delivery_date: data.planned_delivery_date
        ? new Date(String(data.planned_delivery_date))
        : new Date(),
    };
  };

  const form = useForm<FormValues>({
    validate: yupResolver(validationSchema) as unknown as (
      values: FormValues
    ) => Record<string, string>,
    initialValues: {
      // Export Shipment fields
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

      // Ocean Schedule fields
      schedule_id: "",
      carrier_code: "",
      carrier_name: "",
      eta: new Date(),
      etd: new Date(),
      vessel_name: "",
      voyage_no: "",

      // Routing Details - start with one empty row
      routingDetails: [
        {
          move_type: "",
          from_location_code: "",
          to_location_code: "",
          etd: new Date(),
          eta: new Date(),
          carrier_code: "",
          flight_no: null,
          status: "",
        },
      ],

      // Party Details fields
      shipper_code: "",
      shipper_address_id: 0,
      shipper_email: "",
      consignee_code: "",
      consignee_address_id: 0,
      consignee_email: "",
      forwarder_code: "",
      forwarder_address_id: 0,
      forwarder_email: "",
      destination_agent_code: "",
      destination_agent_address_id: 0,
      destination_agent_email: "",
      billing_customer_code: "",
      billing_customer_address_id: 0,
      notify_customer_code: "",
      notify_customer_address_id: 0,
      notify_customer_email: "",
      cha_code: "",
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
      transporter_name: "",
      transporter_email: "",

      // Delivery Details
      delivery_location: "",
      delivery_from_code: "",
      delivery_address_id: "",
      planned_delivery_date: new Date(),

      // Merge with initial data if in edit mode
      ...(isEditMode && initialData
        ? mapInitialDataToFormValues(initialData)
        : {}),
    },
  });

  // Debug: Log the final form values
  console.log("Final form initialValues:", form.values);
  console.log(
    "Mapped initial data:",
    isEditMode && initialData
      ? mapInitialDataToFormValues(initialData)
      : "Not in edit mode"
  );

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

  // Effect to set up display names when in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      console.log("Setting up display names for edit mode:", initialData);

      // Set display names for SearchableSelect components
      if (initialData.shipper_name) {
        setShipperDisplayName(String(initialData.shipper_name));
      }
      if (initialData.consignee_name) {
        setConsigneeDisplayName(String(initialData.consignee_name));
      }
      if (initialData.forwarder_name) {
        setForwarderDisplayName(String(initialData.forwarder_name));
      }
      if (initialData.destination_agent_name) {
        setDestinationAgentDisplayName(
          String(initialData.destination_agent_name)
        );
      }
      if (initialData.billing_customer_name) {
        setBillingCustomerDisplayName(
          String(initialData.billing_customer_name)
        );
      }
      if (initialData.notify_customer_name) {
        setNotifyCustomerDisplayName(String(initialData.notify_customer_name));
      }
      if (initialData.cha_name) {
        setChaDisplayName(String(initialData.cha_name));
      }
      if (initialData.pickup_from_name) {
        setPickupFromDisplayName(String(initialData.pickup_from_name));
      }
      if (initialData.delivery_from_name) {
        setDeliveryFromDisplayName(String(initialData.delivery_from_name));
      }
      if (initialData.pickup_address_text) {
        setPickupAddressDisplayName(String(initialData.pickup_address_text));
      }
      if (initialData.delivery_address_text) {
        setDeliveryAddressDisplayName(
          String(initialData.delivery_address_text)
        );
      }

      // Set routing display names
      if (
        initialData.routing_details &&
        Array.isArray(initialData.routing_details)
      ) {
        const routingNames = (
          initialData.routing_details as Array<Record<string, unknown>>
        ).map((route: Record<string, unknown>) => ({
          from: route.from_location_name
            ? `${String(route.from_location_name)} (${String(route.from_location_code || "")})`
            : null,
          to: route.to_location_name
            ? `${String(route.to_location_name)} (${String(route.to_location_code || "")})`
            : null,
          carrier: route.carrier_name ? String(route.carrier_name) : null,
        }));
        setRoutingDisplayNames(routingNames);
      }

      // Set quotation ID
      if (initialData.quotation_id) {
        setQuotationId(String(initialData.quotation_id));
      }

      // Set up charges from quotation_charges
      if (
        initialData.quotation_charges &&
        Array.isArray(initialData.quotation_charges)
      ) {
        const mappedCharges = (
          initialData.quotation_charges as Array<Record<string, unknown>>
        ).map((charge: Record<string, unknown>, index: number) => ({
          id: index + 1,
          charge_name: String(charge.charge_name || ""),
          currency_country_code: String(
            charge.currency_country_code || charge.currency || ""
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
        }));
        setCharges(mappedCharges);
      }
    }
  }, [isEditMode, initialData]);

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

  // Auto-set customer_service_name when salesperson is selected in self mode
  useEffect(() => {
    if (
      form.values.routed === "Self" &&
      form.values.routed_by &&
      salespersonsData.length > 0
    ) {
      const selectedSalesperson = salespersonsData.find(
        (person) => person.value === form.values.routed_by
      );
      if (selectedSalesperson?.customer_service) {
        form.setFieldValue(
          "customer_service_name",
          selectedSalesperson.customer_service
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.routed, form.values.routed_by, salespersonsData]);

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
            chargeableVolume
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
          volumeWeight
        );
        if (cargo.chargeable_weight !== chargeableWeight) {
          form.setFieldValue(
            "cargo_details.0.chargeable_weight",
            chargeableWeight
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
        (field) => validation.errors[field]
      );

      if (hasRequiredFieldErrors) {
        console.log(
          "Required fields have validation errors:",
          validation.errors
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
      const payload = {
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

        schedule_id: form.values.schedule_id,
        carrier_code: form.values.carrier_code,
        eta: formatDate(form.values.eta),
        etd: formatDate(form.values.etd),
        vessel_name: form.values.vessel_name,
        voyage_no: form.values.voyage_no,

        shipper_code: form.values.shipper_code,
        shipper_address_id: form.values.shipper_address_id,
        shipper_email: form.values.shipper_email,

        consignee_code: form.values.consignee_code,
        consignee_address_id: form.values.consignee_address_id,
        consignee_email: form.values.consignee_email,

        forwarder_code: form.values.forwarder_code,
        forwarder_address_id: form.values.forwarder_address_id,
        forwarder_email: form.values.forwarder_email,

        destination_agent_code: form.values.destination_agent_code,
        destination_agent_address_id: form.values.destination_agent_address_id,
        destination_agent_email: form.values.destination_agent_email,

        billing_customer_code: form.values.billing_customer_code,
        billing_customer_address_id: form.values.billing_customer_address_id,

        notify_customer_code: form.values.notify_customer_code,
        notify_customer_address_id: form.values.notify_customer_address_id,
        notify_customer_email: form.values.notify_customer_email,

        cha_code: form.values.cha_code,
        cha_address_id: form.values.cha_address_id,

        is_hazardous: form.values.is_hazardous,
        commodity_description: form.values.commodity_description,
        marks_no: form.values.marks_no,
        cargo_details: form.values.cargo_details.map((cargo) => ({
          no_of_packages: cargo.no_of_packages || null,
          gross_weight: cargo.gross_weight || null,
          volume_weight: cargo.volume_weight || null,
          chargeable_weight: cargo.chargeable_weight || null,
          volume: cargo.volume || null,
          chargeable_volume: cargo.chargeable_volume || null,
          container_type_code: cargo.container_type_code || null,
          no_of_containers: cargo.no_of_containers || null,
        })),

        pickup_location: form.values.pickup_location,
        pickup_from_code: form.values.pickup_from_code,
        pickup_address_id: form.values.pickup_address_id || "0",
        planned_pickup_date: formatDate(form.values.planned_pickup_date),
        transporter_name: form.values.transporter_name,
        transporter_email: form.values.transporter_email,

        delivery_location: form.values.delivery_location,
        delivery_from_code: form.values.delivery_from_code,
        delivery_address_id: form.values.delivery_address_id || "0",
        planned_delivery_date: formatDate(form.values.planned_delivery_date),

        routing_details: form.values.routingDetails.map((route) => ({
          move_type: route.move_type,
          from_location_code: route.from_location_code,
          to_location_code: route.to_location_code,
          etd: formatDate(route.etd),
          eta: formatDate(route.eta),
          carrier_code: route.carrier_code,
          flight_no: route.flight_no,
          status: route.status,
        })),

        quotation_id: quotationId,
        quotation_charges: charges.map((charge) => ({
          charge_name: charge.charge_name,
          currency_country_code: charge.currency_country_code,
          roe: parseFloat(charge.roe) || 1,
          unit: charge.unit,
          no_of_units: parseFloat(charge.no_of_units) || 0,
          sell_per_unit: parseFloat(charge.sell_per_unit) || 0,
          min_sell: parseFloat(charge.min_sell) || 0,
          cost_per_unit: parseFloat(charge.cost_per_unit) || 0,
          total_cost: parseFloat(charge.total_cost) || 0,
          total_sell: parseFloat(charge.total_sell) || 0,
        })),
      };

      // Add service_type and import_to_export for export bookings
      (payload as Record<string, unknown>).service_type = "EXPORT";
      (payload as Record<string, unknown>).import_to_export = false;

      if (isEditMode) {
        // Use PUT API for edit mode
        await putAPICall("customer-service-shipment/", payload, API_HEADER);
      } else {
        // Use POST API for create mode
        await postAPICall("customer-service-shipment/", payload, API_HEADER);
      }

      // Navigate to export shipment master page with refresh flag
      navigate("/export-shipment", { state: { refreshData: true } });

      // Show success notification immediately after navigation
      ToastNotification({
        type: "success",
        message: `Export shipment ${isEditMode ? "updated" : "created"} successfully!`,
      });

      // Also call onComplete if provided
      onComplete?.();
    } catch (error) {
      console.error("Error submitting export shipment:", error);
      ToastNotification({
        type: "error",
        message: `Failed to ${isEditMode ? "update" : "create"} export shipment. Please try again.`,
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

  const handleStepClick = (step: number) => {
    setActive(step);
    onStepChange?.(step);
  };

  const addRoutingDetail = () => {
    form.insertListItem("routingDetails", {
      move_type: "",
      from_location_code: "",
      to_location_code: "",
      etd: new Date(),
      eta: new Date(),
      carrier_code: "",
      flight_no: null,
      status: "",
    });
    // Add corresponding display name state
    setRoutingDisplayNames([
      ...routingDisplayNames,
      { from: null, to: null, carrier: null },
    ]);
  };

  const removeRoutingDetail = (index: number) => {
    form.removeListItem("routingDetails", index);
    // Remove corresponding display name state
    setRoutingDisplayNames(routingDisplayNames.filter((_, i) => i !== index));
  };

  return (
    <Box px={"lg"}>
      <Stepper
        color="#105476"
        active={active}
        onStepClick={handleStepClick}
        orientation="horizontal"
        allowNextStepsSelect={false}
      >
        {/* Step 1: Export Shipment */}
        <Stepper.Step label="1" description="Export Booking">
          <Box mt="md">
            {/* Export Shipment Section */}
            <Text size="md" fw={600} mb="md" c="#105476">
              Export Booking
            </Text>
            <Grid mb="xl">
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
                      selectedData?.label || ""
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
                  searchable
                  withAsterisk
                  data={["LCL"]}
                  defaultValue="LCL"
                  {...form.getInputProps("service")}
                  onChange={(value) => {
                    form.setFieldValue("service", "LCL");
                  }}
                  readOnly
                />
              </Grid.Col>
              <Grid.Col span={4}>
                {/* <DateInput
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
                <DateInput
                  label="Date"
                  placeholder="YYYY-MM-DD"
                  withAsterisk
                  defaultValue={new Date()}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  clearable
                  styles={{
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
                      selectedData?.label || ""
                    );
                  }}
                  error={form.errors.origin_code as string}
                  minSearchLength={3}
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
                      selectedData?.label || ""
                    );
                  }}
                  error={form.errors.destination_code as string}
                  minSearchLength={3}
                  // placeholder="Select destination"
                  // withAsterisk
                  // searchable
                  // data={[
                  //   "MYPKG - Port Klang, Malaysia",
                  //   "SGSIN - Singapore",
                  //   "USLAX - Los Angeles",
                  //   "DEHAM - Hamburg",
                  // ]}
                  // {...form.getInputProps("destination_code")}
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
                        // Auto-set customer_service_name when salesperson is selected
                        if (value) {
                          const selectedSalesperson = salespersonsData.find(
                            (person) => person.value === value
                          );
                          if (selectedSalesperson?.customer_service) {
                            form.setFieldValue(
                              "customer_service_name",
                              selectedSalesperson.customer_service
                            );
                          }
                        }
                      }}
                      error={form.errors.routed_by}
                    />
                  ) : (
                    <TextInput
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
                  <TextInput
                    label="Routed By"
                    placeholder="Enter routed by"
                    withAsterisk
                    {...form.getInputProps("routed_by")}
                    error={form.errors.routed_by}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Customer Service Name"
                  placeholder="Enter customer service name"
                  withAsterisk
                  value={form.values.customer_service_name}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.target.value);
                    form.setFieldValue("customer_service_name", formattedValue);
                  }}
                  error={form.errors.customer_service_name}
                />
              </Grid.Col>
              {(form.values.service === "AIR" ||
                form.values.service === "FCL") && (
                <Grid.Col span={4}>
                  <Radio.Group
                    label="Direct"
                    mt="md"
                    value={form.values.is_direct ? "true" : "false"}
                    onChange={(value) =>
                      form.setFieldValue("is_direct", value === "true")
                    }
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
                    mt="md"
                    value={form.values.is_coload ? "true" : "false"}
                    onChange={(value) =>
                      form.setFieldValue("is_coload", value === "true")
                    }
                  >
                    <Group mt="xs">
                      <Radio value="true" label="Yes" />
                      <Radio value="false" label="No" />
                    </Group>
                  </Radio.Group>
                </Grid.Col>
              )}
            </Grid>

            {/* Ocean Schedule Section */}
            <Text size="md" fw={600} mb="md" c="#105476">
              Ocean Schedule
            </Text>
            <Grid mb="xl">
              <Grid.Col span={4}>
                <TextInput
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
                      selectedData?.label || ""
                    );
                  }}
                  error={form.errors.carrier_code as string}
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Dropdown
                  label="Vessel Name"
                  placeholder="Select vessel"
                  // withAsterisk
                  searchable
                  data={[
                    "MSC LORETO",
                    "EVER GIVEN",
                    "CMA CGM MARCO POLO",
                    "COSCO SHIPPING UNIVERSE",
                  ]}
                  {...form.getInputProps("vessel_name")}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Voyage Number"
                  placeholder="Enter voyage number"
                  // withAsterisk
                  {...form.getInputProps("voyage_no")}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <DateInput
                  label="ETD (Estimated Time of Departure)"
                  // withAsterisk
                  placeholder="YYYY-MM-DD"
                  value={form.values.etd || new Date()}
                  onChange={(date) => {
                    form.setFieldValue("etd", date || new Date());
                  }}
                  error={form.errors.etd}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  styles={{
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
              </Grid.Col>
              <Grid.Col span={4}>
                <DateInput
                  label="ETA (Estimated Time of Arrival)"
                  // withAsterisk
                  placeholder="YYYY-MM-DD"
                  value={form.values.eta || new Date()}
                  onChange={(date) => {
                    form.setFieldValue("eta", date || new Date());
                  }}
                  error={form.errors.eta}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  styles={{
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
              </Grid.Col>
            </Grid>

            {/* Routing Details Section */}
            <Text size="md" fw={600} mb="md" c="#105476">
              Routings Details
            </Text>

            {/* Header Row */}
            <Grid mb="sm">
              <Grid.Col span={1.25}>
                <Text size="sm" fw={500} c="#105476">
                  Move Type
                </Text>
              </Grid.Col>
              <Grid.Col span={1.25}>
                <Text size="sm" fw={500} c="#105476">
                  From
                </Text>
              </Grid.Col>
              <Grid.Col span={1.25}>
                <Text size="sm" fw={500} c="#105476">
                  To
                </Text>
              </Grid.Col>
              <Grid.Col span={1.25}>
                <Text size="sm" fw={500} c="#105476">
                  ETD
                </Text>
              </Grid.Col>
              <Grid.Col span={1.25}>
                <Text size="sm" fw={500} c="#105476">
                  ETA
                </Text>
              </Grid.Col>
              <Grid.Col span={1.5}>
                <Text size="sm" fw={500} c="#105476">
                  Carrier
                </Text>
              </Grid.Col>
              <Grid.Col span={1.5}>
                <Text size="sm" fw={500} c="#105476">
                  Flight No
                </Text>
              </Grid.Col>
              <Grid.Col span={1.25}>
                <Text size="sm" fw={500} c="#105476">
                  Status
                </Text>
              </Grid.Col>
              <Grid.Col span={1.5}>
                <Text size="sm" fw={500} c="#105476">
                  Actions
                </Text>
              </Grid.Col>
            </Grid>

            {/* Dynamic Form Rows */}
            <Stack>
              {form.values.routingDetails.map((_, index) => (
                <Box key={index}>
                  <Grid>
                    <Grid.Col span={1.25}>
                      <Dropdown
                        data={["SEA", "AIR", "ROAD", "RAIL"]}
                        placeholder="Select move type"
                        // withAsterisk
                        searchable
                        {...form.getInputProps(
                          `routingDetails.${index}.move_type`
                        )}
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
                        displayValue={routingDisplayNames[index]?.from || null}
                        onChange={(value, selectedData) => {
                          form.setFieldValue(
                            `routingDetails.${index}.from_location_code`,
                            value || ""
                          );
                          // Update display name state
                          const updatedDisplayNames = [...routingDisplayNames];
                          updatedDisplayNames[index] = {
                            ...updatedDisplayNames[index],
                            from: selectedData?.label || null,
                          };
                          setRoutingDisplayNames(updatedDisplayNames);
                        }}
                        minSearchLength={3}
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
                          form.values.routingDetails[index]?.to_location_code ||
                          ""
                        }
                        displayValue={routingDisplayNames[index]?.to || null}
                        onChange={(value, selectedData) => {
                          form.setFieldValue(
                            `routingDetails.${index}.to_location_code`,
                            value || ""
                          );
                          // Update display name state
                          const updatedDisplayNames = [...routingDisplayNames];
                          updatedDisplayNames[index] = {
                            ...updatedDisplayNames[index],
                            to: selectedData?.label || null,
                          };
                          setRoutingDisplayNames(updatedDisplayNames);
                        }}
                        minSearchLength={3}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.25}>
                      <DateInput
                        placeholder="YYYY-MM-DD"
                        // withAsterisk
                        value={
                          form.values.routingDetails[index]?.etd || new Date()
                        }
                        onChange={(date) => {
                          form.setFieldValue(
                            `routingDetails.${index}.etd`,
                            date || new Date()
                          );
                        }}
                        valueFormat="YYYY-MM-DD"
                        leftSection={<IconCalendar size={18} />}
                        leftSectionPointerEvents="none"
                        radius="sm"
                        size="sm"
                        nextIcon={<IconChevronRight size={16} />}
                        previousIcon={<IconChevronLeft size={16} />}
                        styles={{
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
                    </Grid.Col>
                    <Grid.Col span={1.25}>
                      <DateInput
                        placeholder="YYYY-MM-DD"
                        // withAsterisk
                        value={
                          form.values.routingDetails[index]?.eta || new Date()
                        }
                        onChange={(date) => {
                          form.setFieldValue(
                            `routingDetails.${index}.eta`,
                            date || new Date()
                          );
                        }}
                        valueFormat="YYYY-MM-DD"
                        leftSection={<IconCalendar size={18} />}
                        leftSectionPointerEvents="none"
                        radius="sm"
                        size="sm"
                        nextIcon={<IconChevronRight size={16} />}
                        previousIcon={<IconChevronLeft size={16} />}
                        styles={{
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
                          form.values.routingDetails[index]?.carrier_code || ""
                        }
                        displayValue={
                          routingDisplayNames[index]?.carrier || null
                        }
                        onChange={(value, selectedData) => {
                          form.setFieldValue(
                            `routingDetails.${index}.carrier_code`,
                            value || ""
                          );
                          // Update display name state
                          const updatedDisplayNames = [...routingDisplayNames];
                          updatedDisplayNames[index] = {
                            ...updatedDisplayNames[index],
                            carrier: selectedData?.label || null,
                          };
                          setRoutingDisplayNames(updatedDisplayNames);
                        }}
                        error={
                          form.errors[
                            `routingDetails.${index}.carrier_code`
                          ] as string
                        }
                        minSearchLength={2}
                        // required
                      />
                    </Grid.Col>
                    <Grid.Col span={1.5}>
                      <TextInput
                        placeholder="Enter flight number"
                        // withAsterisk
                        {...form.getInputProps(
                          `routingDetails.${index}.flight_no`
                        )}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.25}>
                      <Dropdown
                        data={[
                          "Status",
                          "Active",
                          "Inactive",
                          "Pending",
                          "Completed",
                        ]}
                        placeholder="Select status"
                        // withAsterisk
                        searchable
                        {...form.getInputProps(
                          `routingDetails.${index}.status`
                        )}
                      />
                    </Grid.Col>
                    <Grid.Col span={1.5}>
                      <Group gap="xs">
                        {form.values.routingDetails.length - 1 === index && (
                          <Button
                            variant="light"
                            color="#105476"
                            size="xs"
                            onClick={addRoutingDetail}
                          >
                            <IconPlus size={14} />
                          </Button>
                        )}
                        {form.values.routingDetails.length > 1 && (
                          <Button
                            variant="light"
                            color="red"
                            size="xs"
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

            <Group justify="space-between" mt="xl">
              <Button
                variant="outline"
                color="#105476"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate("../")}
              >
                Back to List
              </Button>
              <Button onClick={handleNext} color="#105476">
                Next
              </Button>
            </Group>
          </Box>
        </Stepper.Step>

        {/* Step 2: Party Details */}
        <Stepper.Step label="2" description="Party Details">
          <Box mt="md">
            <Text size="md" fw={600} mb="md" c="#105476">
              Party Details
            </Text>

            {/* Shipper Details */}
            <Text size="sm" fw={500} mb="sm" c="#105476">
              Shipper Details
            </Text>
            <Grid mb="md">
              <Grid.Col span={4}>
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
                    form.setFieldValue("shipper_code", value || "");

                    // Store the selected shipper name for display
                    if (value && selectedData) {
                      setShipperDisplayName(selectedData.label);
                    } else {
                      setShipperDisplayName(null);
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

                      setShipperAddressOptions(addressOptions);

                      // Reset address selection when shipper changes
                      form.setFieldValue("shipper_address_id", 0);
                    } else {
                      setShipperAddressOptions([]);
                      form.setFieldValue("shipper_address_id", 0);
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.shipper_code as string}
                  minSearchLength={2}
                  // required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Dropdown
                  label="Shipper Address"
                  placeholder="Select shipper address"
                  // withAsterisk
                  searchable
                  data={shipperAddressOptions}
                  value={
                    form.values.shipper_address_id
                      ? String(form.values.shipper_address_id)
                      : ""
                  }
                  onChange={(value) => {
                    form.setFieldValue(
                      "shipper_address_id",
                      value ? parseInt(value) : 0
                    );
                  }}
                  error={form.errors.shipper_address_id}
                  disabled={shipperAddressOptions.length === 0}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Shipper E-mail ID"
                  placeholder="Enter email address"
                  {...form.getInputProps("shipper_email")}
                />
              </Grid.Col>
            </Grid>
            <Divider mb="md" />

            {/* Consignee Details */}
            <Text size="sm" fw={500} mb="sm" c="#105476">
              Consignee Details
            </Text>
            <Grid mb="md">
              <Grid.Col span={4}>
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

                    // Store the selected consignee name for display
                    if (value && selectedData) {
                      setConsigneeDisplayName(selectedData.label);
                    } else {
                      setConsigneeDisplayName(null);
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
                  minSearchLength={2}
                  // required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Dropdown
                  label="Consignee Address"
                  placeholder="Select consignee address"
                  // withAsterisk
                  searchable
                  data={consigneeAddressOptions}
                  value={
                    form.values.consignee_address_id
                      ? String(form.values.consignee_address_id)
                      : ""
                  }
                  onChange={(value) => {
                    form.setFieldValue(
                      "consignee_address_id",
                      value ? parseInt(value) : 0
                    );
                  }}
                  error={form.errors.consignee_address_id}
                  disabled={consigneeAddressOptions.length === 0}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Consignee Email Id"
                  placeholder="Enter email address"
                  {...form.getInputProps("consignee_email")}
                />
              </Grid.Col>
            </Grid>
            <Divider mb="md" />

            {/* Forwarder Details */}
            <Text size="sm" fw={500} mb="sm" c="#105476">
              Forwarder Details
            </Text>
            <Grid mb="md">
              <Grid.Col span={4}>
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

                    // Store the selected forwarder name for display
                    if (value && selectedData) {
                      setForwarderDisplayName(selectedData.label);
                    } else {
                      setForwarderDisplayName(null);
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
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={6}>
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
                      value ? parseInt(value) : 0
                    );
                  }}
                  error={form.errors.forwarder_address_id}
                  disabled={forwarderAddressOptions.length === 0}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Forwarder Email Id"
                  placeholder="Enter email address"
                  {...form.getInputProps("forwarder_email")}
                />
              </Grid.Col>
            </Grid>
            <Divider mb="md" />

            {/* Destination Agent Details */}
            <Text size="sm" fw={500} mb="sm" c="#105476">
              Destination Agent Details
            </Text>
            <Grid mb="md">
              <Grid.Col span={4}>
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
                    form.setFieldValue("destination_agent_code", value || "");

                    // Store the selected destination agent name for display
                    if (value && selectedData) {
                      setDestinationAgentDisplayName(selectedData.label);
                    } else {
                      setDestinationAgentDisplayName(null);
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

                      setAgentAddressOptions(addressOptions);

                      // Reset address selection when agent changes
                      form.setFieldValue("destination_agent_address_id", 0);
                    } else {
                      setAgentAddressOptions([]);
                      form.setFieldValue("destination_agent_address_id", 0);
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.destination_agent_code as string}
                  minSearchLength={2}
                  // required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Dropdown
                  label="Destination Agent Address"
                  placeholder="Select agent address"
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
                      value ? parseInt(value) : 0
                    );
                  }}
                  error={form.errors.destination_agent_address_id}
                  disabled={agentAddressOptions.length === 0}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Destination Agent Email Id"
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
              <Grid.Col span={4}>
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

                    // Store the selected billing customer name for display
                    if (value && selectedData) {
                      setBillingCustomerDisplayName(selectedData.label);
                    } else {
                      setBillingCustomerDisplayName(null);
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
                  minSearchLength={2}
                  // required
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Dropdown
                  label="Billing Customer Address"
                  placeholder="Select billing address"
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
                      value ? parseInt(value) : 0
                    );
                  }}
                  error={form.errors.billing_customer_address_id}
                  disabled={billingCustomerAddressOptions.length === 0}
                />
              </Grid.Col>
            </Grid>
            <Divider mb="md" />

            {/* Notify Customer Details */}
            <Text size="sm" fw={500} mb="sm" c="#105476">
              Notify Customer Details
            </Text>
            <Grid mb="md">
              <Grid.Col span={4}>
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

                    // Store the selected notify customer name for display
                    if (value && selectedData) {
                      setNotifyCustomerDisplayName(selectedData.label);
                    } else {
                      setNotifyCustomerDisplayName(null);
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
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Dropdown
                  label="Notify Customer Address"
                  placeholder="Select notify address"
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
                      value ? parseInt(value) : 0
                    );
                  }}
                  error={form.errors.notify_customer_address_id}
                  disabled={notifyCustomerAddressOptions.length === 0}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Notify Customer Email Id"
                  placeholder="Enter email address"
                  {...form.getInputProps("notify_customer_email")}
                />
              </Grid.Col>
            </Grid>
            <Divider mb="md" />

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
                    form.setFieldValue("cha_code", value || "");

                    // Store the selected CHA name for display
                    if (value && selectedData) {
                      setChaDisplayName(selectedData.label);
                    } else {
                      setChaDisplayName(null);
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
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={6}>
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
                      value ? parseInt(value) : 0
                    );
                  }}
                  error={form.errors.cha_address_id}
                  disabled={chaAddressOptions.length === 0}
                />
              </Grid.Col>
            </Grid>

            <Group justify="space-between" mt="xl">
              <Button variant="default" onClick={handlePrevious}>
                Back
              </Button>
              <Button onClick={handleNext} color="#105476">
                Next
              </Button>
            </Group>
          </Box>
        </Stepper.Step>

        {/* Step 3: Cargo Details */}
        <Stepper.Step label="3" description="Cargo Details">
          <Box mt="md">
            <Text size="md" fw={600} mb="md" c="#105476">
              Cargo Details
            </Text>

            {/* Common Fields */}
            <Grid style={{ maxWidth: "80%" }} mb="md">
              <Grid.Col span={6}>
                <Radio.Group
                  label="Hazardous Cargo"
                  value={form.values.is_hazardous ? "true" : "false"}
                  onChange={(value) =>
                    form.setFieldValue("is_hazardous", value === "true")
                  }
                >
                  <Group mt="xs">
                    <Radio value="true" label="Yes" />
                    <Radio value="false" label="No" />
                  </Group>
                </Radio.Group>
              </Grid.Col>
              <Grid.Col span={12}>
                <Textarea
                  label="Commodity Description"
                  placeholder="Enter commodity description"
                  minRows={3}
                  maxRows={6}
                  value={form.values.commodity_description}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.currentTarget.value);
                    form.setFieldValue("commodity_description", formattedValue);
                  }}
                  error={form.errors.commodity_description}
                />
              </Grid.Col>
              <Grid.Col span={12}>
                <TextInput
                  label="Marks No"
                  placeholder="Enter marks and numbers"
                  {...form.getInputProps("marks_no")}
                />
              </Grid.Col>
            </Grid>

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
                      <NumberInput
                        label="No of Packages"
                        placeholder="Enter number of packages"
                        min={1}
                        {...form.getInputProps(
                          "cargo_details.0.no_of_packages"
                        )}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <NumberInput
                        label="Gross Weight (kg)"
                        placeholder="Enter gross weight"
                        min={0}
                        decimalScale={2}
                        {...form.getInputProps("cargo_details.0.gross_weight")}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <NumberInput
                        label="Volume Weight (kg)"
                        placeholder="Enter volume weight"
                        min={0}
                        decimalScale={2}
                        {...form.getInputProps("cargo_details.0.volume_weight")}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <NumberInput
                        label="Chargeable Weight (kg)"
                        // placeholder="Auto-calculated"
                        min={0}
                        decimalScale={2}
                        readOnly
                        {...form.getInputProps(
                          "cargo_details.0.chargeable_weight"
                        )}
                        styles={{
                          input: {
                            backgroundColor: "#f5f5f5",
                            cursor: "not-allowed",
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
                      <NumberInput
                        label="No of Packages"
                        placeholder="Enter number of packages"
                        min={1}
                        {...form.getInputProps(
                          "cargo_details.0.no_of_packages"
                        )}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <NumberInput
                        label="Gross Weight (kg)"
                        placeholder="Enter gross weight"
                        min={0}
                        decimalScale={2}
                        {...form.getInputProps("cargo_details.0.gross_weight")}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <NumberInput
                        label="Volume (cbm)"
                        placeholder="Enter volume"
                        min={0}
                        decimalScale={2}
                        {...form.getInputProps("cargo_details.0.volume")}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <NumberInput
                        label="Chargeable Volume (cbm)"
                        // placeholder="Auto-calculated"
                        min={0}
                        decimalScale={2}
                        readOnly
                        {...form.getInputProps(
                          "cargo_details.0.chargeable_volume"
                        )}
                        styles={{
                          input: {
                            backgroundColor: "#f5f5f5",
                            cursor: "not-allowed",
                          },
                        }}
                      />
                    </Grid.Col>
                  </Grid>
                )}

                {/* FCL Service Cargo Details */}
                {form.values.service === "FCL" && (
                  <Stack gap="md">
                    {form.values.cargo_details.map((_, cargoIndex) => (
                      <Box key={cargoIndex}>
                        <Grid>
                          <Grid.Col span={3}>
                            <Dropdown
                              label="Container Type"
                              placeholder="Select container type"
                              searchable
                              data={containerTypeOptions}
                              nothingFoundMessage="No container types found"
                              {...form.getInputProps(
                                `cargo_details.${cargoIndex}.container_type_code`
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={3}>
                            <NumberInput
                              label="No of Containers"
                              placeholder="Enter number of containers"
                              min={1}
                              {...form.getInputProps(
                                `cargo_details.${cargoIndex}.no_of_containers`
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={3}>
                            <NumberInput
                              label="Gross Weight (kg)"
                              placeholder="Enter gross weight"
                              min={0}
                              decimalScale={2}
                              {...form.getInputProps(
                                `cargo_details.${cargoIndex}.gross_weight`
                              )}
                            />
                          </Grid.Col>
                          {/* Add/Remove buttons */}
                          <Grid.Col
                            span={3}
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
                                    cargoIndex
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

            <Group justify="space-between" mt="xl">
              <Button variant="default" onClick={handlePrevious}>
                Back
              </Button>
              <Button onClick={handleNext} color="#105476">
                Next
              </Button>
            </Group>
          </Box>
        </Stepper.Step>

        {/* Step 4: Pickup/Delivery */}
        <Stepper.Step label="4" description="Pickup/Delivery">
          <Box mt="md">
            <Text size="md" fw={600} mb="md" c="#105476">
              Pickup/Delivery Details
            </Text>
            <Grid style={{ maxWidth: "80%" }}>
              {/* Pickup Details Section */}
              <Grid.Col span={12}>
                <Text size="sm" fw={500} mb="md" c="#105476">
                  Pickup Details
                </Text>
              </Grid.Col>

              {/* Row 1: Pickup Location & Pickup From */}
              <Grid.Col span={6}>
                <TextInput
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
              <Grid.Col span={6}>
                <SearchableSelect
                  label="Pickup Address"
                  placeholder="Type pickup address"
                  apiEndpoint={URL.customer}
                  searchFields={["customer_code", "customer_name"]}
                  displayFormat={(item: Record<string, unknown>) => {
                    // Get the first address from addresses_data
                    const addressesData =
                      (item.addresses_data as Array<Record<string, unknown>>) ||
                      [];
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
              <Grid.Col span={6}>
                <DateInput
                  label="Planned Pickup Date"
                  placeholder="YYYY-MM-DD"
                  defaultValue={new Date()}
                  valueFormat="YYYY-MM-DD"
                  leftSection={<IconCalendar size={18} />}
                  {...form.getInputProps("planned_pickup_date")}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  clearable
                  styles={{
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
              </Grid.Col>

              {/* Row 3: Actual Pickup Date, Transporter Name, Transporter Email */}
              <Grid.Col span={4}>
                <DateInput
                  label="Actual Pickup Date"
                  placeholder="YYYY-MM-DD"
                  valueFormat="YYYY-MM-DD"
                  defaultValue={new Date()}
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  clearable
                  styles={{
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
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Transporter Name"
                  placeholder="Enter transporter name"
                  value={form.values.transporter_name}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.target.value);
                    form.setFieldValue("transporter_name", formattedValue);
                  }}
                  error={form.errors.transporter_name}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Transporter Email Id"
                  placeholder="Enter transporter email"
                  type="email"
                  {...form.getInputProps("transporter_email")}
                />
              </Grid.Col>

              {/* Line Break */}
              <Grid.Col span={12}>
                <Divider my="md" />
              </Grid.Col>

              {/* Delivery Details Section */}
              <Grid.Col span={12}>
                <Text size="sm" fw={500} mb="md" c="#105476">
                  Delivery Details
                </Text>
              </Grid.Col>

              {/* Delivery Location & Delivery From */}
              <Grid.Col span={6}>
                <TextInput
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
              <Grid.Col span={6}>
                <SearchableSelect
                  label="Delivery Address"
                  placeholder="Type delivery address"
                  apiEndpoint={URL.customer}
                  searchFields={["customer_code", "customer_name"]}
                  displayFormat={(item: Record<string, unknown>) => {
                    // Get the first address from addresses_data
                    const addressesData =
                      (item.addresses_data as Array<Record<string, unknown>>) ||
                      [];
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
              <Grid.Col span={6}>
                <DateInput
                  label="Planned Delivery Date"
                  placeholder="YYYY-MM-DD"
                  {...form.getInputProps("planned_delivery_date")}
                  valueFormat="YYYY-MM-DD"
                  defaultValue={new Date()}
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  clearable
                  styles={{
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
              </Grid.Col>
              <Grid.Col span={6}>
                <DateInput
                  label="Actual Delivery Date"
                  placeholder="YYYY-MM-DD"
                  defaultValue={new Date()}
                  valueFormat="YYYY-MM-DD"
                  clearable
                  leftSection={<IconCalendar size={18} />}
                  leftSectionPointerEvents="none"
                  radius="sm"
                  size="sm"
                  nextIcon={<IconChevronRight size={16} />}
                  previousIcon={<IconChevronLeft size={16} />}
                  styles={{
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
              </Grid.Col>

              {/* Line Break */}
              <Grid.Col span={12}>
                <Divider my="md" />
              </Grid.Col>
            </Grid>

            <Group justify="space-between" mt="xl">
              <Button variant="default" onClick={handlePrevious}>
                Back
              </Button>
              <Button onClick={handleNext} color="#105476">
                Next
              </Button>
            </Group>
          </Box>
        </Stepper.Step>

        {/* Step 5: Rate Details */}
        <Stepper.Step label="5" description="Rate Details">
          <Box mt="md">
            <Text size="md" fw={600} mb="md" c="#105476">
              Rate Details
            </Text>

            {/* Quotation/Contract No - Separate common field */}
            <Grid mb="md">
              <Grid.Col span={4}>
                <TextInput
                  label="Quotation/Contract No"
                  value={quotationId}
                  onChange={(event) =>
                    setQuotationId(event.currentTarget.value)
                  }
                  placeholder="Enter quotation number"
                />
              </Grid.Col>
            </Grid>

            {/* Charges Table */}
            <Grid style={{ maxWidth: "100%", marginLeft: "7px" }}>
              {/* Headers */}
              <Grid
                style={{
                  fontWeight: 600,
                  color: "#105476",
                  borderBottom: "2px solid #105476",
                  paddingBottom: "8px",
                  marginBottom: "16px",
                }}
              >
                <Grid.Col span={1.5}>Charge Name</Grid.Col>
                <Grid.Col span={1}>Currency</Grid.Col>
                <Grid.Col span={0.75}>ROE</Grid.Col>
                <Grid.Col span={1}>Unit</Grid.Col>
                <Grid.Col span={0.75}>No of Units</Grid.Col>
                <Grid.Col span={1}>Sell Per Unit</Grid.Col>
                <Grid.Col span={1}>Min Sell</Grid.Col>
                <Grid.Col span={1}>Cost Per Unit</Grid.Col>
                <Grid.Col span={1}>Total Sell</Grid.Col>
                <Grid.Col span={1}>Total Cost</Grid.Col>
                <Grid.Col span={1}>Actions</Grid.Col>
              </Grid>

              {/* Dynamic Charge Rows */}
              {charges.map((charge, index) => (
                <Box key={charge.id} mb="md">
                  <Grid mb="xs" style={{ alignItems: "center" }}>
                    <Grid.Col span={1.5}>
                      <TextInput
                        placeholder="Charge Name"
                        value={charge.charge_name}
                        onChange={(event) =>
                          updateCharge(
                            charge.id,
                            "charge_name",
                            event.currentTarget.value
                          )
                        }
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <Dropdown
                        placeholder="Select Currency"
                        searchable
                        value={charge.currency_country_code}
                        onChange={(value) =>
                          updateCharge(
                            charge.id,
                            "currency_country_code",
                            value || ""
                          )
                        }
                        data={[
                          "INR",
                          "USD",
                          "EUR",
                          "GBP",
                          "AED",
                          "SGD",
                          "CNY",
                          "JPY",
                          "HKD",
                          "AUD",
                        ]}
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={0.75}>
                      <TextInput
                        placeholder="ROE"
                        value={charge.roe}
                        onChange={(event) =>
                          updateCharge(
                            charge.id,
                            "roe",
                            event.currentTarget.value
                          )
                        }
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <Dropdown
                        placeholder="Select Unit"
                        value={charge.unit}
                        onChange={(value) =>
                          updateCharge(charge.id, "unit", value || "")
                        }
                        data={[
                          { value: "20ft", label: "20ft" },
                          { value: "40ft", label: "40ft" },
                          { value: "20'FR", label: "20fr" },
                          { value: "shipment", label: "shpt" },
                          { value: "W/m", label: "W/m" },
                        ]}
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={0.75}>
                      <TextInput
                        placeholder="0"
                        value={charge.no_of_units}
                        onChange={(event) =>
                          updateCharge(
                            charge.id,
                            "no_of_units",
                            event.currentTarget.value
                          )
                        }
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <TextInput
                        placeholder="0.00"
                        value={charge.sell_per_unit}
                        onChange={(event) =>
                          updateCharge(
                            charge.id,
                            "sell_per_unit",
                            event.currentTarget.value
                          )
                        }
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <TextInput
                        placeholder="0.00"
                        value={charge.min_sell}
                        onChange={(event) =>
                          updateCharge(
                            charge.id,
                            "min_sell",
                            event.currentTarget.value
                          )
                        }
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <TextInput
                        placeholder="0.00"
                        value={charge.cost_per_unit}
                        onChange={(event) =>
                          updateCharge(
                            charge.id,
                            "cost_per_unit",
                            event.currentTarget.value
                          )
                        }
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <TextInput
                        value={charge.total_sell || ""}
                        readOnly
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col span={1}>
                      <TextInput
                        value={charge.total_cost || ""}
                        readOnly
                        size="xs"
                      />
                    </Grid.Col>
                    <Grid.Col
                      span={1}
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        height: "100%",
                      }}
                    >
                      {index === charges.length - 1 && (
                        <Button
                          size="xs"
                          variant="light"
                          color="#105476"
                          onClick={addNewCharge}
                        >
                          <IconPlus size={16} />
                        </Button>
                      )}
                      {charges.length > 1 && (
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={() => removeCharge(charge.id)}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                    </Grid.Col>
                  </Grid>
                </Box>
              ))}
            </Grid>

            {/* Totals */}
            <Grid
              mt="md"
              style={{
                fontWeight: 600,
                color: "#105476",
                borderTop: "1px solid #ccc",
                paddingTop: "0.5rem",
              }}
            >
              <Grid.Col span={7} />
              <Grid.Col span={1} ml={10}>
                Total:
              </Grid.Col>
              <Grid.Col span={1}>
                {charges
                  .reduce((sum, charge) => {
                    const totalSell = parseFloat(charge.total_sell) || 0;
                    return sum + totalSell;
                  }, 0)
                  .toFixed(2)}
              </Grid.Col>
              <Grid.Col span={1}>
                {charges
                  .reduce((sum, charge) => {
                    const totalCost = parseFloat(charge.total_cost) || 0;
                    return sum + totalCost;
                  }, 0)
                  .toFixed(2)}
              </Grid.Col>
            </Grid>

            <Group justify="space-between" mt="xl">
              <Button variant="default" onClick={handlePrevious}>
                Back
              </Button>
              <Button
                rightSection={<IconCheck size={16} />}
                onClick={handleSubmit}
                color="#105476"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating booking..." : "Submit"}
              </Button>
            </Group>
          </Box>
        </Stepper.Step>
      </Stepper>
    </Box>
  );
};

export default LCLExportGenerationStepper;
