import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Stepper,
  Text,
  TextInput,
  Divider,
  Card,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Modal,
  Loader,
  Center,
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
  IconEye,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import {
  ToastNotification,
  SearchableSelect,
  Dropdown,
  SingleDateInput,
} from "../../../components";
import { generateCargoArrivalNoticePDF } from "../../jobs/pdf/CargoArrivalNoticePDFTemplate";
import { generateDeliveryOrderPDF } from "../../jobs/pdf/DeliveryOrderPDFTemplate";
import useAuthStore from "../../../store/authStore";
import dayjs from "dayjs";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useQuery } from "@tanstack/react-query";
import { toTitleCase } from "../../../utils/textFormatter";

// Type definitions
type MBLDetailsForm = {
  service: string;
  origin_agent: string; // Stores customer_code (code) for API payload
  origin_agent_name: string; // Stores customer_name (name) for display
  origin_agent_address: string; // Stores address from addresses_data
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
  vessel_name: string;
  voyage_number: string;
  mbl_number: string;
  mbl_date: Date | null;
};

type RoutingDetail = {
  id?: number | string;
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
  // Separate fields based on transport_type
  flight: string; // For Air transport
  truck_no: string; // For Road transport
  rail_no: string; // For Rail transport
  voyage_number: string; // For Sea transport
  // Keep flight_voyage_number for backward compatibility and UI display
  flight_voyage_number: string;
};

type ContainerDetail = {
  id?: number | string;
  container_type: string;
  container_no: string;
  actual_seal_no: string;
  customs_seal_no: string;
  loading_date: Date | null;
  unloading_date: Date | null;
};

// Validation schemas
const mblDetailsSchema = yup.object({
  service: yup.string().required("Service is required"),
  origin_agent: yup.string().required("Origin Agent is required"),
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
  vessel_name: yup.string().required("Vessel Name is required"),
  voyage_number: yup.string().required("Voyage Number is required"),
  mbl_number: yup.string().required("MBL Number is required"),
  mbl_date: yup.date().nullable(),
});

const containerDetailSchema = yup.object({
  container_type: yup.string().required("Container Type is required"),
  container_no: yup.string().required("Container No is required"),
  actual_seal_no: yup.string().nullable(),
  customs_seal_no: yup.string().nullable(),
  loading_date: yup.date().nullable(),
  unloading_date: yup.date().nullable(),
});

const containerDetailsFormSchema = yup.object({
  containers: yup
    .array()
    .of(containerDetailSchema)
    .min(1, "At least one container detail is required")
    .test(
      "unique-container-no",
      "Container numbers must be unique",
      function (containers) {
        if (!containers || containers.length === 0) return true;
        const containerNos = containers
          .map((c) => c.container_no?.trim())
          .filter((no) => no && no !== "");
        const uniqueContainerNos = new Set(containerNos);
        return uniqueContainerNos.size === containerNos.length;
      }
    ),
});

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

type HousingDetail = {
  id?: number | string;
  shipment_id: string;
  hbl_number: string;
  routed: string;
  routed_by?: string;
  origin_code: string;
  origin_name?: string;
  destination_code: string;
  destination_name?: string;
  customer_service: string;
  trade: string;
  origin_agent_name: string;
  origin_agent_address: string;
  origin_agent_email: string;
  shipper_name: string;
  shipper_address: string;
  shipper_email: string;
  consignee_name: string;
  consignee_address: string;
  consignee_email: string;
  notify_customer1_name: string;
  notify_customer1_address: string;
  notify_customer1_email: string;
  commodity_description: string;
  marks_no: string;
  cargo_details?: Array<{
    id?: number | string;
    container_no?: number | string;
    container_id?: number | null;
    no_of_packages: number | null;
    gross_weight: number | null;
    volume: number | null;
    chargeable_weight: number | null;
    haz: boolean | null;
  }>;
  charges?: Array<{
    id?: number | string; // ID from backend when editing
    charge_name: string;
    pp_cc: string;
    unit_code: string;
    no_of_unit: number | null;
    currency: string;
    roe: number | null;
    amount_per_unit: number | null;
    amount: number | null;
  }>;
  mbl_charges?: Array<Record<string, unknown>>;
};

// Helper function to get transport_mode based on transport_type
const getTransportMode = (
  transportType: string | null | undefined
): string | undefined => {
  if (!transportType) return undefined;
  const type = transportType.trim();
  if (type === "Air") return "AIR";
  if (type === "Sea" || type === "FCL" || type === "LCL") return "SEA";
  if (type === "Road") return "LAND";
  return undefined;
};

function ImportJobCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const jobData = location.state?.job;
  const user = useAuthStore((state) => state.user);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [housingDetails, setHousingDetails] = useState<HousingDetail[]>(
    location.state?.housingDetails &&
      Array.isArray(location.state.housingDetails)
      ? location.state.housingDetails
      : []
  );

  // PDF Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [currentHousingForPreview, setCurrentHousingForPreview] =
    useState<HousingDetail | null>(null);

  // Delivery Order preview state
  const [doPreviewOpen, setDoPreviewOpen] = useState(false);
  const [doPdfBlob, setDoPdfBlob] = useState<string | null>(null);
  const [currentHousingForDoPreview, setCurrentHousingForDoPreview] =
    useState<HousingDetail | null>(null);

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

  // MBL Details Form
  const mblDetailsForm = useForm<MBLDetailsForm>({
    initialValues: {
      service: "",
      origin_agent: "", // Stores customer_code
      origin_agent_name: "", // Stores customer_name for display
      origin_agent_address: "", // Stores address from addresses_data
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      etd: null,
      eta: null,
      atd: null,
      ata: null,
    },
    validate: yupResolver(mblDetailsSchema),
  });

  // Carrier Details Form
  const carrierDetailsForm = useForm<CarrierDetailsForm>({
    initialValues: {
      schedule_id: "",
      carrier_code: "",
      carrier_name: "",
      vessel_name: "",
      voyage_number: "",
      mbl_number: "",
      mbl_date: null,
    },
    validate: yupResolver(carrierDetailsSchema),
  });

  // Routings Form - Using useForm like charges in QuotationCreate
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
          truck_no: "",
          rail_no: "",
          voyage_number: "",
          flight_voyage_number: "",
        },
      ],
    },
  });

  // Container Details Form - Using useForm similar to routings
  const containerDetailsForm = useForm<{ containers: ContainerDetail[] }>({
    initialValues: {
      containers: [
        {
          container_type: "",
          container_no: "",
          actual_seal_no: "",
          customs_seal_no: "",
          loading_date: null,
          unloading_date: null,
        },
      ],
    },
    validate: yupResolver(containerDetailsFormSchema),
  });

  // Load job data if in edit or view mode
  useEffect(() => {
    if (jobData && (mode === "edit" || mode === "view")) {
      try {
        let mblData, carrierData, housingData, containerData, routingData;
        if (location.state?.fromHouseCreate) {
          setActive(2);
          mblData = location.state?.mblDetails;
          carrierData = location.state?.carrierDetails;
          housingData = location.state?.housingDetails;
          containerData = location.state?.containerDetails;
          routingData = location.state?.routings;
        } else {
          mblData = jobData;
          carrierData = jobData;
          housingData = jobData.housing_details;
          containerData = jobData.container_details;
          routingData = jobData.ocean_routings?.length
            ? jobData.ocean_routings
            : jobData.routings?.length
              ? jobData.routings
              : [];
        }
        // Populate MBL Details
        // Extract origin_agent_address from origin_agent_data if available
        let originAgentAddress = "";
        if (mblData.origin_agent_data) {
          const originAgentData = mblData.origin_agent_data as Record<
            string,
            unknown
          >;
          if (
            originAgentData.addresses_data &&
            Array.isArray(originAgentData.addresses_data)
          ) {
            const addressesData = originAgentData.addresses_data as Array<{
              id: number;
              address: string;
            }>;
            if (addressesData.length > 0 && addressesData[0].address) {
              originAgentAddress = addressesData[0].address;
            }
          }
        }

        mblDetailsForm.setValues({
          service: mblData.service || "",
          origin_agent: mblData.origin_agent_code || mblData.origin_agent || "",
          origin_agent_name: mblData.origin_agent_name || "",
          origin_agent_address: originAgentAddress,
          origin_code: mblData.origin_code || "",
          origin_name: mblData.origin_name || "",
          destination_code: mblData.destination_code || "",
          destination_name: mblData.destination_name || "",
          etd:
            mblData.etd && dayjs(mblData.etd).isValid()
              ? dayjs(mblData.etd).toDate()
              : null,
          eta:
            mblData.eta && dayjs(mblData.eta).isValid()
              ? dayjs(mblData.eta).toDate()
              : null,
          atd:
            mblData.atd && dayjs(mblData.atd).isValid()
              ? dayjs(mblData.atd).toDate()
              : null,
          ata:
            mblData.ata && dayjs(mblData.ata).isValid()
              ? dayjs(mblData.ata).toDate()
              : null,
        });

        // Populate Carrier Details using setValues
        // Use the exact field names from the API response
        carrierDetailsForm.setValues({
          schedule_id: carrierData.schedule_id || "",
          carrier_code: carrierData.carrier_code || "",
          carrier_name: carrierData.carrier_name || "",
          vessel_name: carrierData.vessel_name || "",
          voyage_number: carrierData.voyage_number || "",
          mbl_number: carrierData.mbl_number || "",
          mbl_date:
            carrierData.mbl_date && dayjs(carrierData.mbl_date).isValid()
              ? dayjs(carrierData.mbl_date).toDate()
              : null,
        });

        // Populate Housing Details from jobData if exists
        if (
          housingData &&
          Array.isArray(housingData) &&
          housingData.length > 0
        ) {
          const mappedHousingDetails = housingData.map(
            (house: Record<string, unknown>) => ({
              id: house.id
                ? typeof house.id === "number"
                  ? house.id
                  : Number(house.id)
                : undefined,
              shipment_id: house.shipment_id ? String(house.shipment_id) : "",
              hbl_number: house.hbl_number ? String(house.hbl_number) : "",
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
              origin_agent_name: house.origin_agent_name
                ? String(house.origin_agent_name)
                : "",
              origin_agent_address: house.origin_agent_address
                ? String(house.origin_agent_address)
                : "",
              origin_agent_email: house.origin_agent_email
                ? String(house.origin_agent_email)
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
                        id: cargo.id
                          ? typeof cargo.id === "number"
                            ? cargo.id
                            : Number(cargo.id)
                          : undefined,
                        container_no: cargo.container_no as number | string,
                        container_id: cargo.container_id
                          ? typeof cargo.container_id === "number"
                            ? cargo.container_id
                            : Number(cargo.container_id)
                          : undefined,
                        no_of_packages: cargo.no_of_packages as number | null,
                        gross_weight: cargo.gross_weight as number | null,
                        volume: cargo.volume as number | null,
                        chargeable_weight: cargo.chargeable_weight as
                          | number
                          | null,
                        haz:
                          cargo.haz !== null && cargo.haz !== undefined
                            ? typeof cargo.haz === "boolean"
                              ? cargo.haz
                              : cargo.haz === "Yes" ||
                                cargo.haz === true ||
                                String(cargo.haz).toLowerCase() === "yes"
                            : null,
                      })
                    )
                  : [],
              charges:
                house.charges &&
                Array.isArray(house.charges) &&
                house.charges.length > 0
                  ? house.charges.map((charge: Record<string, unknown>) => ({
                      id: charge.id
                        ? typeof charge.id === "number"
                          ? charge.id
                          : Number(charge.id)
                        : undefined,
                      charge_name: charge.charge_name
                        ? String(charge.charge_name)
                        : "",
                      pp_cc: charge.pp_cc ? String(charge.pp_cc) : "",
                      unit_code: charge.unit_code
                        ? String(charge.unit_code)
                        : "",
                      no_of_unit: charge.no_of_unit as number | null,
                      currency: charge.currency ? String(charge.currency) : "",
                      roe: charge.roe as number | null,
                      amount_per_unit: charge.amount_per_unit as number | null,
                      amount: charge.amount as number | null,
                    }))
                  : house.mbl_charges &&
                      Array.isArray(house.mbl_charges) &&
                      house.mbl_charges.length > 0
                    ? house.mbl_charges.map(
                        (charge: Record<string, unknown>) => {
                          // Handle mbl_charges structure: unit can be in charge.unit or charge.unit_details.unit_code
                          const unitCode = charge.unit_code
                            ? String(charge.unit_code)
                            : charge.unit
                              ? String(charge.unit)
                              : (charge.unit_details as Record<string, unknown>)
                                    ?.unit_code
                                ? String(
                                    (
                                      charge.unit_details as Record<
                                        string,
                                        unknown
                                      >
                                    ).unit_code
                                  )
                                : "";

                          // Handle currency: can be in charge.currency or charge.currency_details.currency_code
                          const currencyCode = charge.currency
                            ? String(charge.currency)
                            : (
                                  charge.currency_details as Record<
                                    string,
                                    unknown
                                  >
                                )?.currency_code
                              ? String(
                                  (
                                    charge.currency_details as Record<
                                      string,
                                      unknown
                                    >
                                  ).currency_code
                                )
                              : "";

                          // Handle roe: can be string or number
                          const roeValue =
                            charge.roe !== null && charge.roe !== undefined
                              ? typeof charge.roe === "string"
                                ? parseFloat(charge.roe) || null
                                : (charge.roe as number)
                              : null;

                          // Handle amount_per_unit: can be string or number
                          const amountPerUnit =
                            charge.amount_per_unit !== null &&
                            charge.amount_per_unit !== undefined
                              ? typeof charge.amount_per_unit === "string"
                                ? parseFloat(charge.amount_per_unit) || null
                                : (charge.amount_per_unit as number)
                              : null;

                          // Handle amount: can be string or number
                          const amount =
                            charge.amount !== null &&
                            charge.amount !== undefined
                              ? typeof charge.amount === "string"
                                ? parseFloat(charge.amount) || null
                                : (charge.amount as number)
                              : null;

                          return {
                            id: charge.id
                              ? typeof charge.id === "number"
                                ? charge.id
                                : Number(charge.id)
                              : undefined,
                            charge_name: charge.charge_name
                              ? String(charge.charge_name)
                              : "",
                            pp_cc: charge.pp_cc ? String(charge.pp_cc) : "",
                            unit_code: unitCode,
                            no_of_unit:
                              charge.no_of_unit !== null &&
                              charge.no_of_unit !== undefined
                                ? typeof charge.no_of_unit === "number"
                                  ? charge.no_of_unit
                                  : Number(charge.no_of_unit)
                                : null,
                            currency: currencyCode,
                            roe: roeValue,
                            amount_per_unit: amountPerUnit,
                            amount: amount,
                          };
                        }
                      )
                    : [],
            })
          );
          setHousingDetails(mappedHousingDetails);
        }

        // Populate Routings if exists
        if (
          routingData &&
          Array.isArray(routingData) &&
          routingData.length > 0
        ) {
          const mappedRoutings = routingData.map(
            (routing: Record<string, unknown>) => {
              // Map fields based on transport type from API response
              const transportType = String(
                routing.transport_type || ""
              ).toLowerCase();

              // Extract values based on transport_type
              let flight = "";
              let truck_no = "";
              let rail_no = "";
              let voyage_number = "";
              let flightVoyageNumber = "";

              if (transportType === "sea" || transportType === "vessel") {
                voyage_number = routing.voyage_number
                  ? String(routing.voyage_number)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = voyage_number;
              } else if (transportType === "air") {
                flight = routing.flight
                  ? String(routing.flight)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = flight;
              } else if (transportType === "road") {
                truck_no = routing.truck_no
                  ? String(routing.truck_no)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = truck_no;
              } else if (transportType === "rail") {
                rail_no = routing.rail_no
                  ? String(routing.rail_no)
                  : routing.flight_voyage_number
                    ? String(routing.flight_voyage_number)
                    : "";
                flightVoyageNumber = rail_no;
              } else {
                // Fallback: try to determine from available fields
                if (routing.voyage_number) {
                  voyage_number = String(routing.voyage_number);
                  flightVoyageNumber = voyage_number;
                } else if (routing.flight) {
                  flight = String(routing.flight);
                  flightVoyageNumber = flight;
                } else if (routing.truck_no) {
                  truck_no = String(routing.truck_no);
                  flightVoyageNumber = truck_no;
                } else if (routing.rail_no) {
                  rail_no = String(routing.rail_no);
                  flightVoyageNumber = rail_no;
                } else if (routing.flight_voyage_number) {
                  flightVoyageNumber = String(routing.flight_voyage_number);
                }
              }

              return {
                id: routing.id
                  ? typeof routing.id === "number"
                    ? routing.id
                    : Number(routing.id)
                  : undefined,
                transport_type: routing.transport_type
                  ? String(routing.transport_type)
                  : "",
                from_code: routing.from_port_code
                  ? String(routing.from_port_code)
                  : routing.from_code
                    ? String(routing.from_code)
                    : "",
                from_name: routing.from_port_name
                  ? String(routing.from_port_name)
                  : routing.from_name
                    ? String(routing.from_name)
                    : "",
                to_code: routing.to_port_code
                  ? String(routing.to_port_code)
                  : routing.to_code
                    ? String(routing.to_code)
                    : "",
                to_name: routing.to_port_name
                  ? String(routing.to_port_name)
                  : routing.to_name
                    ? String(routing.to_name)
                    : "",
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
                carrier_code: routing.carrier_code
                  ? String(routing.carrier_code)
                  : "",
                carrier_name: routing.carrier_name
                  ? String(routing.carrier_name)
                  : "",
                vessel: routing.vessel ? String(routing.vessel) : "",
                flight: flight,
                truck_no: truck_no,
                rail_no: rail_no,
                voyage_number: voyage_number,
                flight_voyage_number: flightVoyageNumber,
              };
            }
          );
          routingsForm.setValues({ routings: mappedRoutings });
        }

        // Populate Container Details from jobData if exists
        if (
          containerData &&
          Array.isArray(containerData) &&
          containerData.length > 0
        ) {
          const mappedContainers = containerData.map(
            (container: Record<string, unknown>) => {
              // Get container_type_code from container_type_details if available
              const containerTypeDetails = container.container_type_details as
                | Record<string, unknown>
                | undefined;
              const containerTypeCode =
                containerTypeDetails?.container_type_code
                  ? String(containerTypeDetails.container_type_code)
                  : container.container_type
                    ? String(container.container_type)
                    : "";

              // Map uploading_date to unloading_date (API uses uploading_date, form uses unloading_date)
              const unloadingDate =
                container.unloading_date || container.uploading_date;

              return {
                id: container.id
                  ? typeof container.id === "number"
                    ? container.id
                    : Number(container.id)
                  : undefined,
                container_type: containerTypeCode,
                container_no: container.container_no
                  ? String(container.container_no)
                  : "",
                actual_seal_no: container.actual_seal_no
                  ? String(container.actual_seal_no)
                  : "",
                customs_seal_no: container.customs_seal_no
                  ? String(container.customs_seal_no)
                  : "",
                loading_date:
                  container.loading_date &&
                  dayjs(container.loading_date as string | Date).isValid()
                    ? dayjs(container.loading_date as string | Date).toDate()
                    : null,
                unloading_date:
                  unloadingDate &&
                  dayjs(unloadingDate as string | Date).isValid()
                    ? dayjs(unloadingDate as string | Date).toDate()
                    : null,
              };
            }
          );
          containerDetailsForm.setValues({ containers: mappedContainers });
        }
      } catch (error) {
        console.error("Error loading job data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to load job data. Please try again.",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobData, mode]);

  // Restore form values from location.state when navigating back from HouseCreate
  // This runs after the jobData loading effect to avoid conflicts
  useEffect(() => {
    // Check if we're navigating back from HouseCreate (indicated by housingDetails in location.state)
    // const isNavigatingBackFromHouseCreate = location.state?.housingDetails && Array.isArray(location.state.housingDetails) && location.state.housingDetails.length > 0;
    const isNavigatingBackFromHouseCreate =
      location.state?.fromHouseCreate === true;

    if (
      mode !== "create" ||
      !(
        isNavigatingBackFromHouseCreate ||
        location.state?.mblDetails ||
        location.state?.carrierDetails ||
        location.state?.routings ||
        location.state?.containerDetails
      )
    ) {
      return; // Exit early → NO restore in edit mode
    }
    // Restore form values when:
    // 1. We're navigating back from HouseCreate (has housingDetails) OR
    // 2. We're in create mode and have form data in location.state
    // But skip if we're in initial edit load (has jobData but no housingDetails)
    const shouldRestore =
      mode === "create" &&
      (isNavigatingBackFromHouseCreate ||
        location.state?.mblDetails ||
        location.state?.carrierDetails ||
        location.state?.routings ||
        location.state?.containerDetails);

    if (mode === "create" && shouldRestore) {
      // Restore MBL Details
      if (location.state?.mblDetails) {
        const mblDetails = location.state.mblDetails;
        mblDetailsForm.setValues({
          service: mblDetails.service || "",
          origin_agent: mblDetails.origin_agent || "",
          origin_agent_name: mblDetails.origin_agent_name || "",
          origin_agent_address: mblDetails.origin_agent_address || "",
          origin_code: mblDetails.origin_code || "",
          origin_name: mblDetails.origin_name || "",
          destination_code: mblDetails.destination_code || "",
          destination_name: mblDetails.destination_name || "",
          etd: mblDetails.etd || null,
          eta: mblDetails.eta || null,
          atd: mblDetails.atd || null,
          ata: mblDetails.ata || null,
        });
      }

      // Restore Carrier Details
      if (location.state?.carrierDetails) {
        carrierDetailsForm.setValues(location.state.carrierDetails);
      }

      // Restore Routings
      if (
        location.state?.routings &&
        Array.isArray(location.state.routings) &&
        location.state.routings.length > 0
      ) {
        routingsForm.setValues({ routings: location.state.routings });
      }

      // Restore Container Details
      if (
        location.state?.containerDetails &&
        Array.isArray(location.state.containerDetails) &&
        location.state.containerDetails.length > 0
      ) {
        containerDetailsForm.setValues({
          containers: location.state.containerDetails,
        });
      }

      // Set active step to 2 (Container Details) when navigating back from HouseCreate
      // This ensures the user sees the HBL list after saving
      if (isNavigatingBackFromHouseCreate) {
        setActive(2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    location.state?.mblDetails,
    location.state?.carrierDetails,
    location.state?.routings,
    location.state?.containerDetails,
    location.state?.housingDetails,
    mode,
    jobData,
  ]);

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
      truck_no: "",
      rail_no: "",
      voyage_number: "",
      flight_voyage_number: "",
    });
  };

  // Remove routing - Using removeListItem like charges form
  const removeRouting = (index: number) => {
    if (routingsForm.values.routings.length > 1) {
      routingsForm.removeListItem("routings", index);
    }
  };

  // Add new container - Using insertListItem
  const addContainer = () => {
    containerDetailsForm.insertListItem("containers", {
      container_type: "",
      container_no: "",
      actual_seal_no: "",
      customs_seal_no: "",
      loading_date: null,
      unloading_date: null,
    });
  };

  // Remove container - Using removeListItem
  const removeContainer = (index: number) => {
    if (containerDetailsForm.values.containers.length > 1) {
      containerDetailsForm.removeListItem("containers", index);
    }
  };

  // Validate step 1
  const validateStep1 = () => {
    const mblValid = mblDetailsForm.validate().hasErrors === false;
    const carrierValid = carrierDetailsForm.validate().hasErrors === false;
    return mblValid && carrierValid;
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
      // Get the appropriate field value based on transport_type
      let flightVoyageNumber = "";
      if (
        transportType.toLowerCase() === "sea" ||
        transportType.toLowerCase() === "vessel"
      ) {
        flightVoyageNumber =
          routing.voyage_number?.trim() ||
          routing.flight_voyage_number?.trim() ||
          "";
      } else if (transportType.toLowerCase() === "air") {
        flightVoyageNumber =
          routing.flight?.trim() || routing.flight_voyage_number?.trim() || "";
      } else if (transportType.toLowerCase() === "road") {
        flightVoyageNumber =
          routing.truck_no?.trim() ||
          routing.flight_voyage_number?.trim() ||
          "";
      } else if (transportType.toLowerCase() === "rail") {
        flightVoyageNumber =
          routing.rail_no?.trim() || routing.flight_voyage_number?.trim() || "";
      } else {
        flightVoyageNumber = routing.flight_voyage_number?.trim() || "";
      }

      const hasAnyMandatoryValue =
        transportType !== "" ||
        fromCode !== "" ||
        toCode !== "" ||
        routing.etd !== null ||
        routing.eta !== null ||
        carrierCode !== "" ||
        vessel !== "" ||
        flightVoyageNumber !== "";

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

        // Validate transport-type-specific required fields using correct field names
        if (routing.transport_type === "Sea") {
          const voyageNumber = routing.voyage_number?.trim() || "";
          if (vessel === "" || voyageNumber === "") {
            ToastNotification({
              type: "error",
              message:
                "Vessel Name and Voyage Number are required for Sea transport",
            });
            return false;
          }
        } else if (routing.transport_type === "Air") {
          const flight = routing.flight?.trim() || "";
          if (carrierCode === "" || flight === "") {
            ToastNotification({
              type: "error",
              message: "Carrier and Flight No are required for Air transport",
            });
            return false;
          }
        } else if (routing.transport_type === "Road") {
          const truckNo = routing.truck_no?.trim() || "";
          if (carrierCode === "" || truckNo === "") {
            ToastNotification({
              type: "error",
              message: "Carrier and Truck No are required for Road transport",
            });
            return false;
          }
        } else if (routing.transport_type === "Rail") {
          const railNo = routing.rail_no?.trim() || "";
          if (carrierCode === "" || railNo === "") {
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

  // Validate step 3 - Container Details
  // At least one container detail is required
  const validateStep3 = () => {
    const validation = containerDetailsForm.validate();
    if (validation.hasErrors) {
      // Errors are automatically set on the form, which will display field-level errors
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
        // Save container details before moving to step 3
        // navigate(location.pathname, {
        //   replace: true,
        //   state: {
        //     ...location.state,
        //     containerDetails: containerDetailsForm.values.containers,
        //     // Preserve all other state
        //     ...(location.state?.housingDetails && {
        //       housingDetails: location.state.housingDetails,
        //     }),
        //     ...(location.state?.mblDetails && {
        //       mblDetails: location.state.mblDetails,
        //     }),
        //     ...(location.state?.carrierDetails && {
        //       carrierDetails: location.state.carrierDetails,
        //     }),
        //     ...(location.state?.routings && {
        //       routings: location.state.routings,
        //     }),
        //     ...(location.state?.job && { job: location.state.job }),
        //   },
        // });
        setActive(2);
      }
    } else if (active === 2) {
      if (validateStep3()) {
        // Save container details before submitting
        // navigate(location.pathname, {
        //   replace: true,
        //   state: {
        //     ...location.state,
        //     containerDetails: containerDetailsForm.values.containers,
        //     // Preserve all other state
        //     ...(location.state?.housingDetails && {
        //       housingDetails: location.state.housingDetails,
        //     }),
        //     ...(location.state?.mblDetails && {
        //       mblDetails: location.state.mblDetails,
        //     }),
        //     ...(location.state?.carrierDetails && {
        //       carrierDetails: location.state.carrierDetails,
        //     }),
        //     ...(location.state?.routings && {
        //       routings: location.state.routings,
        //     }),
        //     ...(location.state?.job && { job: location.state.job }),
        //   },
        // });
        handleSubmit();
      }
    }
  };

  // Handle previous step
  const handlePrev = () => {
    if (active > 0) {
      // Save container details to location.state before going back
      // if (active === 2) {
      //   // We're on step 3 (container details), save them before going back
      //   navigate(location.pathname, {
      //     replace: true,
      //     state: {
      //       ...location.state,
      //       containerDetails: containerDetailsForm.values.containers,
      //       // Preserve all other state
      //       ...(location.state?.housingDetails && {
      //         housingDetails: location.state.housingDetails,
      //       }),
      //       ...(location.state?.mblDetails && {
      //         mblDetails: location.state.mblDetails,
      //       }),
      //       ...(location.state?.carrierDetails && {
      //         carrierDetails: location.state.carrierDetails,
      //       }),
      //       ...(location.state?.routings && {
      //         routings: location.state.routings,
      //       }),
      //       ...(location.state?.job && { job: location.state.job }),
      //     },
      //   });
      // }
      setActive(active - 1);
    }
  };

  // Check if Save Container button should be enabled
  // At least one container must have both container_type and container_no filled
  const canSaveContainerDetails = useMemo(() => {
    return containerDetailsForm.values.containers.some(
      (container) =>
        container.container_type?.trim() && container.container_no?.trim()
    );
  }, [containerDetailsForm.values.containers]);

  // Check if Add HBL button should be enabled
  // At least one container must have both container_type and container_no filled
  const canAddHBL = useMemo(() => {
    return containerDetailsForm.values.containers.some(
      (container) =>
        container.container_type?.trim() && container.container_no?.trim()
    );
  }, [containerDetailsForm.values.containers]);

  // Handle save container details
  const handleSaveContainerDetails = () => {
    // Validate container details before saving
    const validation = containerDetailsForm.validate();
    if (validation.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please fill all required container details before saving",
      });
      return;
    } else {
      ToastNotification({
        type: "success",
        message: "Container details saved. Proceed for HBL Entry",
      });
      return;
    }

    // // Save container details to location.state
    // navigate(location.pathname, {
    //   replace: true,
    //   state: {
    //     ...location.state,
    //     containerDetails: containerDetailsForm.values.containers,
    //     // Preserve all other state
    //     ...(location.state?.housingDetails && {
    //       housingDetails: location.state.housingDetails,
    //     }),
    //     ...(location.state?.mblDetails && {
    //       mblDetails: location.state.mblDetails,
    //     }),
    //     ...(location.state?.carrierDetails && {
    //       carrierDetails: location.state.carrierDetails,
    //     }),
    //     ...(location.state?.routings && {
    //       routings: location.state.routings,
    //     }),
    //     ...(location.state?.job && { job: location.state.job }),
    //   },
    // });

    // // Navigate to step 1 after saving
    // setActive(2);
  };

  // Fetch container type data
  const fetchContainerType = async () => {
    try {
      const response = await getAPICall(`${URL.containerType}`, API_HEADER);
      return response;
    } catch (error) {
      console.error("Error fetching container type data:", error);
    }
  };

  // Container type data query with memoization
  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: fetchContainerType,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Container type options memoized
  const containerTypeData = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];
    return rawContainerData.map((item: Record<string, unknown>) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: item.container_name ? String(item.container_name) : "",
    }));
  }, [rawContainerData]);

  // Memoize additionalParams to prevent SearchableSelect from recreating fetchData on every render
  // This prevents infinite API calls
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  // Don't update location state on every keystroke - only when navigating to HouseCreate
  // This prevents infinite re-renders and input issues
  // Container details are preserved in form state and passed when navigating to HouseCreate

  // Update housing details when location state changes
  useEffect(() => {
    if (
      location.state?.housingDetails &&
      Array.isArray(location.state.housingDetails) &&
      location.state.housingDetails.length > 0
    ) {
      setHousingDetails(location.state.housingDetails);
    }
  }, [location.state?.housingDetails]);

  // Remove housing detail
  const removeHousingDetail = (index: number) => {
    const updated = housingDetails.filter((_, i) => i !== index);
    setHousingDetails(updated);
  };

  // Helper function to navigate to HouseCreate with container numbers
  const navigateToHouseCreate = useCallback(
    (editIndex?: number, editData?: HousingDetail) => {
      // Validate MBL mandatory fields before navigating
      const missingFields: string[] = [];

      if (!mblDetailsForm.values.service?.trim()) {
        missingFields.push("Service");
      }
      if (!mblDetailsForm.values.origin_agent?.trim()) {
        missingFields.push("Origin Agent");
      }
      if (!mblDetailsForm.values.origin_code?.trim()) {
        missingFields.push("Origin");
      }
      if (!mblDetailsForm.values.destination_code?.trim()) {
        missingFields.push("Destination");
      }
      if (!mblDetailsForm.values.etd) {
        missingFields.push("ETD");
      }
      if (!mblDetailsForm.values.eta) {
        missingFields.push("ETA");
      }

      if (missingFields.length > 0) {
        ToastNotification({
          type: "error",
          message: `Please fill all mandatory MBL details.`,
        });
        setActive(0);
        return;
      }

      // Extract container numbers from container details
      const containerNumbers = containerDetailsForm.values.containers
        .map((container) => container.container_no)
        .filter((no) => no && no.trim() !== "");

      navigate("/SeaExport/import-job/house-create", {
        state: {
          fromHouseCreate: true,
          housingDetails: housingDetails,
          ...(editIndex !== undefined && { editIndex }),
          ...(editData && { editData }),
          ...(jobData && { job: jobData }),
          mblDetails: {
            service: mblDetailsForm.values.service || "",
            origin_agent: mblDetailsForm.values.origin_agent || "",
            origin_agent_name: mblDetailsForm.values.origin_agent_name || "",
            origin_agent_address:
              mblDetailsForm.values.origin_agent_address || "",
            origin_code: mblDetailsForm.values.origin_code || "",
            origin_name: mblDetailsForm.values.origin_name || "",
            destination_code: mblDetailsForm.values.destination_code || "",
            destination_name: mblDetailsForm.values.destination_name || "",
            etd: mblDetailsForm.values.etd || null,
            eta: mblDetailsForm.values.eta || null,
            atd: mblDetailsForm.values.atd || null,
            ata: mblDetailsForm.values.ata || null,
          },
          carrierDetails: carrierDetailsForm.values,
          routings: routingsForm.values.routings,
          containerNumbers: containerNumbers,
          containerDetails: containerDetailsForm.values.containers,
        },
      });
    },
    [
      mblDetailsForm.values,
      containerDetailsForm.values.containers,
      carrierDetailsForm.values,
      routingsForm.values.routings,
      housingDetails,
      jobData,
    ]
  );

  // Handle edit housing detail
  const handleEditHousingDetail = (index: number) => {
    const houseToEdit = housingDetails[index];
    navigateToHouseCreate(index, houseToEdit);
  };

  // Check if all requirements are met for Create button
  // Enable on all steps (0, 1, 2) if all required data is present
  const canCreateJob = useMemo(() => {
    // Check MBL mandatory fields
    const mblFieldsValid =
      mblDetailsForm.values.service?.trim() &&
      mblDetailsForm.values.origin_agent?.trim() &&
      mblDetailsForm.values.origin_code?.trim() &&
      mblDetailsForm.values.destination_code?.trim() &&
      mblDetailsForm.values.etd &&
      mblDetailsForm.values.eta;

    // Check at least one container detail is added with both type and number
    const hasValidContainers = containerDetailsForm.values.containers.some(
      (container) =>
        container.container_type?.trim() && container.container_no?.trim()
    );

    // Check at least one HBL detail is added
    const hasHousingDetails = housingDetails.length > 0;

    return mblFieldsValid && hasValidContainers && hasHousingDetails;
  }, [
    mblDetailsForm.values.service,
    mblDetailsForm.values.origin_agent,
    mblDetailsForm.values.origin_code,
    mblDetailsForm.values.destination_code,
    mblDetailsForm.values.etd,
    mblDetailsForm.values.eta,
    containerDetailsForm.values.containers,
    housingDetails.length,
  ]);

  // Handle form submission
  // Generate Cargo Arrival Notice PDF
  const generateCargoArrivalNoticePDFPreview = async (
    housing: HousingDetail
  ) => {
    try {
      setPreviewOpen(true);
      setCurrentHousingForPreview(housing);

      // Get default branch from user store or use default
      const defaultBranch = user?.branches?.find(
        (branch) => branch.is_default
      ) ||
        user?.branches?.[0] || { branch_name: "CHENNAI" };
      const country = user?.country || null;

      // Combine job data and housing data for PDF generation
      const combinedData = {
        ...jobData,
        ...housing,
        mawbDetails: {
          service: mblDetailsForm.values.service,
          origin_agent: mblDetailsForm.values.origin_agent,
          origin_code: mblDetailsForm.values.origin_code,
          origin_name: mblDetailsForm.values.origin_name,
          destination_code: mblDetailsForm.values.destination_code,
          destination_name: mblDetailsForm.values.destination_name,
          etd: mblDetailsForm.values.etd,
          eta: mblDetailsForm.values.eta,
          atd: mblDetailsForm.values.atd,
          ata: mblDetailsForm.values.ata,
        },
        carrierDetails: {
          carrier_code: carrierDetailsForm.values.carrier_code,
          carrier_name: carrierDetailsForm.values.carrier_name,
          vessel_name: carrierDetailsForm.values.vessel_name,
          voyage_number: carrierDetailsForm.values.voyage_number,
          mbl_number: carrierDetailsForm.values.mbl_number,
          mbl_date: carrierDetailsForm.values.mbl_date,
        },
        notes: jobData?.notes || [],
      };

      const blobUrl = generateCargoArrivalNoticePDF(
        combinedData,
        housing,
        defaultBranch,
        country
      );
      setPdfBlob(blobUrl);
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
    setCurrentHousingForPreview(null);
    if (pdfBlob) {
      window.URL.revokeObjectURL(pdfBlob);
    }
  };

  // Handle download PDF
  const handleDownloadPDF = () => {
    if (pdfBlob && currentHousingForPreview) {
      const link = document.createElement("a");
      link.href = pdfBlob;
      link.download = `Cargo-Arrival-Notice-${currentHousingForPreview.hbl_number || "HBL"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  // Generate Delivery Order PDF Preview
  const generateDeliveryOrderPDFPreview = async (housing: HousingDetail) => {
    try {
      setDoPreviewOpen(true);
      setCurrentHousingForDoPreview(housing);

      // Combine job data and housing data for PDF generation
      const combinedData = {
        ...jobData,
        ...housing,
        mawbDetails: {
          service: mblDetailsForm.values.service,
          origin_agent: mblDetailsForm.values.origin_agent,
          origin_code: mblDetailsForm.values.origin_code,
          origin_name: mblDetailsForm.values.origin_name,
          destination_code: mblDetailsForm.values.destination_code,
          destination_name: mblDetailsForm.values.destination_name,
          etd: mblDetailsForm.values.etd,
          eta: mblDetailsForm.values.eta,
          atd: mblDetailsForm.values.atd,
          ata: mblDetailsForm.values.ata,
        },
        carrierDetails: {
          carrier_code: carrierDetailsForm.values.carrier_code,
          carrier_name: carrierDetailsForm.values.carrier_name,
          vessel_name: carrierDetailsForm.values.vessel_name,
          voyage_number: carrierDetailsForm.values.voyage_number,
          mbl_number: carrierDetailsForm.values.mbl_number,
          mbl_date: carrierDetailsForm.values.mbl_date,
        },
        containerDetails: jobData?.containerDetails || [],
      };

      const blobUrl = generateDeliveryOrderPDF(combinedData, housing);
      setDoPdfBlob(blobUrl);
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
    setCurrentHousingForDoPreview(null);
    if (doPdfBlob) {
      window.URL.revokeObjectURL(doPdfBlob);
    }
  };

  // Handle download DO PDF
  const handleDownloadDoPDF = () => {
    if (doPdfBlob && currentHousingForDoPreview) {
      const link = document.createElement("a");
      link.href = doPdfBlob;
      link.download = `Delivery-Order-${currentHousingForDoPreview.hbl_number || "HBL"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ToastNotification({
        type: "success",
        message: "PDF downloaded successfully",
      });
    }
  };

  const handleSubmit = async () => {
    // Ensure we're using the latest form values by constructing payload right before API call
    setIsSubmitting(true);

    // Validate: At least one HBL detail is required
    if (housingDetails.length === 0) {
      ToastNotification({
        type: "error",
        message: "At least one HBL detail is required before creating MBL",
      });
      setIsSubmitting(false);
      return;
    }

    // Validate MBL and Carrier details before submission
    const mblValidation = mblDetailsForm.validate();
    const carrierValidation = carrierDetailsForm.validate();

    if (mblValidation.hasErrors || carrierValidation.hasErrors) {
      ToastNotification({
        type: "error",
        message: "Please fill all required fields in MBL & Carrier Details",
      });
      setIsSubmitting(false);
      return;
    }

    // Validate routings if any field has value
    if (!validateStep2()) {
      setIsSubmitting(false);
      return;
    }

    // Validate container details - this will set field-level errors
    if (!validateStep3()) {
      // Navigate to step 3 to show validation errors
      setActive(2);
      setIsSubmitting(false);
      return;
    }
    try {
      const payload = {
        service: mblDetailsForm.values.service,
        service_type: "Import", // Based on the example payload
        origin_agent: mblDetailsForm.values.origin_agent || null,
        origin_code: mblDetailsForm.values.origin_code,
        destination_code: mblDetailsForm.values.destination_code,
        etd: mblDetailsForm.values.etd
          ? dayjs(mblDetailsForm.values.etd).isValid()
            ? dayjs(mblDetailsForm.values.etd).format("YYYY-MM-DD")
            : null
          : null,
        eta: mblDetailsForm.values.eta
          ? dayjs(mblDetailsForm.values.eta).isValid()
            ? dayjs(mblDetailsForm.values.eta).format("YYYY-MM-DD")
            : null
          : null,
        atd: mblDetailsForm.values.atd
          ? dayjs(mblDetailsForm.values.atd).isValid()
            ? dayjs(mblDetailsForm.values.atd).format("YYYY-MM-DD")
            : null
          : null,
        ata: mblDetailsForm.values.ata
          ? dayjs(mblDetailsForm.values.ata).isValid()
            ? dayjs(mblDetailsForm.values.ata).format("YYYY-MM-DD")
            : null
          : null,
        carrier_code: carrierDetailsForm.values.carrier_code,
        vessel_name: carrierDetailsForm.values.vessel_name || null,
        voyage_number: carrierDetailsForm.values.voyage_number || null,
        mbl_number: carrierDetailsForm.values.mbl_number || null,
        mbl_date: carrierDetailsForm.values.mbl_date
          ? dayjs(carrierDetailsForm.values.mbl_date).isValid()
            ? dayjs(carrierDetailsForm.values.mbl_date).format("YYYY-MM-DD")
            : null
          : null,
        ocean_routings: routingsForm.values.routings.map((routing) => {
          // New format: all fields are nullable
          const routingPayload: Record<string, unknown> = {
            // Include id if it exists (for edit mode) - handle id === 0 as valid
            ...(routing.id !== undefined &&
              routing.id !== null &&
              routing.id !== "" && { id: Number(routing.id) }),
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
            truck_no: null,
            rail_no: null,
            voyage_number: null,
          };

          // Map fields based on transport type - use the correct field names from form
          const transportType = String(
            routing.transport_type || ""
          ).toLowerCase();

          if (transportType === "sea" || transportType === "vessel") {
            routingPayload.vessel = routing.vessel || null;
            routingPayload.voyage_number = routing.voyage_number || null;
          } else if (transportType === "air") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.flight = routing.flight || null;
          } else if (transportType === "road") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.truck_no = routing.truck_no || null;
          } else if (transportType === "rail") {
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.rail_no = routing.rail_no || null;
          } else {
            // Default case - include all fields if transport type is not set
            routingPayload.carrier_code = routing.carrier_code || null;
            routingPayload.vessel = routing.vessel || null;
            routingPayload.flight = routing.flight || null;
            routingPayload.truck_no = routing.truck_no || null;
            routingPayload.rail_no = routing.rail_no || null;
            routingPayload.voyage_number = routing.voyage_number || null;
          }

          return routingPayload;
        }),
        housing_details: housingDetails.map((house) => ({
          // Include id and shipment_id when editing (for update operations)
          ...(house.id && { id: house.id }),
          ...(house.shipment_id && { shipment_id: house.shipment_id }),
          hbl_number: house.hbl_number,
          routed: house.routed,
          routed_by: house.routed_by || null,
          origin_code: house.origin_code,
          destination_code: house.destination_code,
          customer_service: house.customer_service || "",
          trade: house.trade,
          origin_agent_name: house.origin_agent_name,
          origin_agent_address: house.origin_agent_address || "",
          origin_agent_email: house.origin_agent_email || "",
          shipper_name: house.shipper_name,
          shipper_address: house.shipper_address || "",
          shipper_email: house.shipper_email || "",
          consignee_name: house.consignee_name,
          consignee_address: house.consignee_address || "",
          consignee_email: house.consignee_email || "",
          notify_customer1_name: house.notify_customer1_name || "",
          notify_customer1_address: house.notify_customer1_address || "",
          notify_customer1_email: house.notify_customer1_email || "",
          commodity_description: house.commodity_description || "",
          marks_no: house.marks_no || "",
          cargo_details: (house.cargo_details || []).map((cargo) => ({
            ...(cargo.id && { id: cargo.id }),
            // Include both container_no and container_id in edit mode if they exist
            ...(cargo.container_no && { container_no: cargo.container_no }),
            ...(cargo.container_id && { container_id: cargo.container_id }),
            no_of_packages: cargo.no_of_packages,
            gross_weight: cargo.gross_weight,
            volume: cargo.volume,
            chargeable_weight: cargo.chargeable_weight,
            haz:
              cargo.haz !== null && cargo.haz !== undefined
                ? typeof cargo.haz === "boolean"
                  ? cargo.haz
                  : cargo.haz === "Yes" ||
                    cargo.haz === true ||
                    String(cargo.haz).toLowerCase() === "yes"
                : null,
          })),
          // Each housing detail has its own mbl_charges
          mbl_charges: (house.charges || []).map((charge) => ({
            // Include id only in edit mode if it exists
            ...(mode === "edit" &&
              charge.id && {
                id:
                  typeof charge.id === "number" ? charge.id : Number(charge.id),
              }),
            charge_name: charge.charge_name || "",
            pp_cc: charge.pp_cc || "",
            unit_input: charge.unit_code || "",
            no_of_unit: charge.no_of_unit || null,
            currency: charge.currency || "",
            roe: charge.roe || null,
            amount_per_unit: charge.amount_per_unit || null,
            amount: charge.amount || null,
          })),
        })),
        container_details: containerDetailsForm.values.containers.map(
          (container) => {
            return {
              ...(container.id && { id: container.id }),
              container_type_input: container.container_type || null,
              container_no: container.container_no || null,
              actual_seal_no: container.actual_seal_no || null,
              customs_seal_no: container.customs_seal_no || null,
              loading_date: container.loading_date
                ? dayjs(container.loading_date).format("YYYY-MM-DD")
                : null,
              uploading_date: container.unloading_date
                ? dayjs(container.unloading_date).format("YYYY-MM-DD")
                : null,
            };
          }
        ),
      };

      // API call to create or update import job
      if (mode === "edit" && jobData?.id) {
        // Edit mode: Use PUT method with ID in payload
        await putAPICall(
          URL.importJob,
          {
            ...payload,
            id: jobData.id,
          },
          API_HEADER
        );
      } else {
        // Create mode: Use POST method
        await postAPICall(URL.importJob, payload, API_HEADER);
      }

      ToastNotification({
        type: "success",
        message: `Import Job ${mode === "edit" ? "updated" : "created"} successfully`,
      });

      // Clear housing details from state when navigating and trigger refetch
      navigate("/SeaExport/import-job", {
        state: { housingDetails: [], refreshData: true },
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

  return (
    <Box p="md" maw={1200} mx="auto">
      <Group justify="space-between" align="center" mb="lg">
        <Text size="xl" fw={600} c="#105476">
          {mode === "view"
            ? "View Import Job"
            : mode === "edit"
              ? "Edit Import Job"
              : "Create Import Job"}
        </Text>
        {!isReadOnly && (
          <Group gap="xs">
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
            {housingDetails.length > 0 && (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="light" color="#105476" size="lg">
                    <IconDotsVertical size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Preview PDF</Menu.Label>
                  {housingDetails.map((housing, idx) => (
                    <Menu.Item
                      key={idx}
                      leftSection={<IconEye size={14} />}
                      onClick={() =>
                        generateCargoArrivalNoticePDFPreview(housing)
                      }
                    >
                      Cargo Arrival Notice -{" "}
                      {housing.hbl_number || `HBL ${idx + 1}`}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  {housingDetails.map((housing, idx) => (
                    <Menu.Item
                      key={`do-${idx}`}
                      leftSection={<IconEye size={14} />}
                      onClick={() => generateDeliveryOrderPDFPreview(housing)}
                    >
                      Delivery Order - {housing.hbl_number || `HBL ${idx + 1}`}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        )}
      </Group>

      <Stepper
        color="#105476"
        active={active}
        onStepClick={isReadOnly ? setActive : undefined}
        orientation="horizontal"
        allowNextStepsSelect={isReadOnly}
      >
        {/* Stepper 1: MBL Details & Carrier Details */}
        <Stepper.Step label="1" description="MBL & Carrier Details">
          <Box mt="md">
            {/* MBL Details Section */}
            <Group align="center" mb="md">
              <Text size="lg" fw={600} c="#105476">
                MBL Details
              </Text>
            </Group>
            <Grid mb="sm">
              <Grid.Col span={2.5}>
                <Dropdown
                  label="Service"
                  required
                  placeholder="Select Service"
                  searchable
                  data={["FCL", "LCL"]}
                  {...mblDetailsForm.getInputProps("service")}
                />
              </Grid.Col>

              <Grid.Col span={2.5}>
                <SearchableSelect
                  label="Origin Agent"
                  required
                  placeholder="Type agent name"
                  apiEndpoint={URL.agent}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code), // Use code as value for API payload
                    label: String(item.customer_name), // Display name to user
                  })}
                  value={mblDetailsForm.values.origin_agent} // Stores customer_code
                  displayValue={mblDetailsForm.values.origin_agent_name} // Displays customer_name
                  onChange={(value, selectedData, originalData) => {
                    // Store customer_code as value (for API payload)
                    mblDetailsForm.setFieldValue("origin_agent", value || "");
                    // Store customer_name for display
                    mblDetailsForm.setFieldValue(
                      "origin_agent_name",
                      selectedData?.label || ""
                    );

                    // Extract address from addresses_data if available
                    if (
                      value &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      const addressesData = (
                        originalData as Record<string, unknown>
                      ).addresses_data as Array<{
                        id: number;
                        address: string;
                      }>;

                      // Auto-select the first address if available
                      if (
                        addressesData &&
                        addressesData.length > 0 &&
                        addressesData[0].address
                      ) {
                        mblDetailsForm.setFieldValue(
                          "origin_agent_address",
                          addressesData[0].address
                        );
                      } else {
                        mblDetailsForm.setFieldValue(
                          "origin_agent_address",
                          ""
                        );
                      }
                    } else {
                      mblDetailsForm.setFieldValue("origin_agent_address", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={mblDetailsForm.errors.origin_agent as string}
                  minSearchLength={2}
                />
              </Grid.Col>

              <Grid.Col span={2.5}>
                <SearchableSelect
                  label="Origin"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type the origin"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={mblDetailsForm.values.origin_code}
                  displayValue={
                    mblDetailsForm.values.origin_name
                      ? `${mblDetailsForm.values.origin_name} (${mblDetailsForm.values.origin_code})`
                      : mblDetailsForm.values.origin_code
                  }
                  onChange={(value, selectedData) => {
                    mblDetailsForm.setFieldValue("origin_code", value || "");
                    if (selectedData) {
                      mblDetailsForm.setFieldValue(
                        "origin_name",
                        selectedData.label.split(" (")[0] || ""
                      );
                    } else if (!value) {
                      mblDetailsForm.setFieldValue("origin_name", "");
                    }
                  }}
                  additionalParams={seaTransportParams}
                  minSearchLength={2}
                  error={mblDetailsForm.errors.origin_code as string}
                />
              </Grid.Col>

              <Grid.Col span={2.5}>
                <SearchableSelect
                  label="Destination"
                  required
                  apiEndpoint={URL.portMaster}
                  placeholder="Type the destination"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
                  value={mblDetailsForm.values.destination_code}
                  displayValue={
                    mblDetailsForm.values.destination_name
                      ? `${mblDetailsForm.values.destination_name} (${mblDetailsForm.values.destination_code})`
                      : mblDetailsForm.values.destination_code
                  }
                  onChange={(value, selectedData) => {
                    mblDetailsForm.setFieldValue(
                      "destination_code",
                      value || ""
                    );
                    if (selectedData) {
                      mblDetailsForm.setFieldValue(
                        "destination_name",
                        selectedData.label.split(" (")[0] || ""
                      );
                    } else if (!value) {
                      mblDetailsForm.setFieldValue("destination_name", "");
                    }
                    // Note: Don't update location.state on every keystroke - only when navigating to HouseCreate
                    // This prevents infinite re-renders and API calls
                  }}
                  additionalParams={seaTransportParams}
                  minSearchLength={2}
                  error={mblDetailsForm.errors.destination_code as string}
                />
              </Grid.Col>
            </Grid>

            {/* Second row for ETD, ETA, ATD, ATA */}
            <Grid mb="xl">
              <Grid.Col span={2.5}>
                <SingleDateInput
                  label="ETD"
                  withAsterisk
                  placeholder="YYYY-MM-DD"
                  {...(() => {
                    const inputProps = mblDetailsForm.getInputProps("etd");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        mblDetailsForm.setFieldValue("etd", value);
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
                    const inputProps = mblDetailsForm.getInputProps("eta");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        mblDetailsForm.setFieldValue("eta", value);
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
                    const inputProps = mblDetailsForm.getInputProps("atd");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        mblDetailsForm.setFieldValue("atd", value);
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
                    const inputProps = mblDetailsForm.getInputProps("ata");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        mblDetailsForm.setFieldValue("ata", value);
                      },
                    };
                  })()}
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
                  label="Carrier"
                  required
                  apiEndpoint={URL.carrier}
                  placeholder="Type carrier name"
                  searchFields={["carrier_code", "carrier_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.carrier_code),
                    label: String(item.carrier_name),
                  })}
                  value={carrierDetailsForm.values.carrier_code}
                  displayValue={carrierDetailsForm.values.carrier_name}
                  onChange={(value, selectedData) => {
                    carrierDetailsForm.setFieldValue(
                      "carrier_code",
                      value || ""
                    );
                    carrierDetailsForm.setFieldValue(
                      "carrier_name",
                      selectedData?.label || ""
                    );
                  }}
                  minSearchLength={2}
                  error={carrierDetailsForm.errors.carrier_code as string}
                  additionalParams={
                    mblDetailsForm.values.service
                      ? {
                          transport_mode:
                            mblDetailsForm.values.service === "FCL" ||
                            mblDetailsForm.values.service === "LCL"
                              ? "SEA"
                              : mblDetailsForm.values.service === "AIR"
                                ? "AIR"
                                : "",
                        }
                      : undefined
                  }
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Vessel Name"
                  required
                  placeholder="Enter vessel name"
                  {...carrierDetailsForm.getInputProps("vessel_name")}
                  error={carrierDetailsForm.errors.vessel_name}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="Voyage Number"
                  required
                  placeholder="Enter voyage number"
                  {...carrierDetailsForm.getInputProps("voyage_number")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <TextInput
                  label="MBL Number"
                  required
                  placeholder="Enter MBL number"
                  {...carrierDetailsForm.getInputProps("mbl_number")}
                />
              </Grid.Col>

              <Grid.Col span={2}>
                <SingleDateInput
                  label="MBL Date"
                  placeholder="YYYY-MM-DD"
                  {...(() => {
                    const inputProps =
                      carrierDetailsForm.getInputProps("mbl_date");
                    return {
                      value: inputProps.value as Date | null,
                      error: inputProps.error as string | undefined,
                      onChange: (value: Date | null) => {
                        carrierDetailsForm.setFieldValue("mbl_date", value);
                      },
                    };
                  })()}
                  size="sm"
                />
              </Grid.Col>
            </Grid>
          </Box>
        </Stepper.Step>

        {/* Stepper 2: Routings */}
        <Stepper.Step label="2" description="Routings">
          <Box mt="md">
            <Text size="lg" fw={600} c="#105476" mb="md">
              Routings{" "}
              {routingsForm.values?.routings?.length > 1 &&
                `(${routingsForm.values?.routings?.length})`}
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
                        data={["Air", "Sea", "Road", "Rail"]}
                        value={
                          routingsForm.values.routings[index]?.transport_type ||
                          null
                        }
                        onChange={(value) => {
                          routingsForm.setFieldValue(
                            `routings.${index}.transport_type`,
                            value || ""
                          );
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
                            value || ""
                          );
                          if (selectedData) {
                            const portName =
                              selectedData.label.split(" (")[0] || "";
                            routingsForm.setFieldValue(
                              `routings.${index}.from_name`,
                              portName
                            );
                          } else if (!value) {
                            routingsForm.setFieldValue(
                              `routings.${index}.from_name`,
                              ""
                            );
                          }
                        }}
                        minSearchLength={2}
                        additionalParams={
                          getTransportMode(routing.transport_type)
                            ? {
                                transport_mode: getTransportMode(
                                  routing.transport_type
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
                            value || ""
                          );
                          if (selectedData) {
                            const portName =
                              selectedData.label.split(" (")[0] || "";
                            routingsForm.setFieldValue(
                              `routings.${index}.to_name`,
                              portName
                            );
                          } else if (!value) {
                            routingsForm.setFieldValue(
                              `routings.${index}.to_name`,
                              ""
                            );
                          }
                        }}
                        minSearchLength={2}
                        additionalParams={
                          getTransportMode(routing.transport_type)
                            ? {
                                transport_mode: getTransportMode(
                                  routing.transport_type
                                )!,
                              }
                            : undefined
                        }
                      />
                    </Grid.Col>

                    {/* Dynamic field labels based on transport type */}
                    {routing.transport_type === "Sea" && (
                      <>
                        <Grid.Col span={2}>
                          <TextInput
                            label="Vessel"
                            required
                            placeholder="Enter vessel name"
                            value={routing.vessel || ""}
                            onChange={(e) => {
                              const formattedValue = toTitleCase(
                                e.target.value
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.vessel`,
                                formattedValue
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
                          <TextInput
                            label="Voyage Number"
                            required
                            placeholder="Enter voyage number"
                            value={routing.voyage_number || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              routingsForm.setFieldValue(
                                `routings.${index}.voyage_number`,
                                value
                              );
                              // Also update flight_voyage_number for backward compatibility
                              routingsForm.setFieldValue(
                                `routings.${index}.flight_voyage_number`,
                                value
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.voyage_number`
                              ] as string
                            }
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "Air" && (
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
                                value || ""
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_name`,
                                selectedData?.label || ""
                              );
                            }}
                            minSearchLength={2}
                            additionalParams={
                              getTransportMode(routing.transport_type)
                                ? {
                                    transport_mode: getTransportMode(
                                      routing.transport_type
                                    )!,
                                  }
                                : undefined
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={2.5}>
                          <TextInput
                            label="Flight Number"
                            required
                            placeholder="Enter flight number"
                            value={routing.flight || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              routingsForm.setFieldValue(
                                `routings.${index}.flight`,
                                value
                              );
                              // Also update flight_voyage_number for backward compatibility
                              routingsForm.setFieldValue(
                                `routings.${index}.flight_voyage_number`,
                                value
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.flight`
                              ] as string
                            }
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "Road" && (
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
                                value || ""
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_name`,
                                selectedData?.label || ""
                              );
                            }}
                            minSearchLength={2}
                            additionalParams={
                              getTransportMode(routing.transport_type)
                                ? {
                                    transport_mode: getTransportMode(
                                      routing.transport_type
                                    )!,
                                  }
                                : undefined
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={2.5}>
                          <TextInput
                            label="Truck Number"
                            required
                            placeholder="Enter truck number"
                            value={routing.truck_no || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              routingsForm.setFieldValue(
                                `routings.${index}.truck_no`,
                                value
                              );
                              // Also update flight_voyage_number for backward compatibility
                              routingsForm.setFieldValue(
                                `routings.${index}.flight_voyage_number`,
                                value
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.truck_no`
                              ] as string
                            }
                          />
                        </Grid.Col>
                      </>
                    )}

                    {routing.transport_type === "Rail" && (
                      <>
                        <Grid.Col span={2}>
                          <TextInput
                            label="Carrier"
                            required
                            placeholder="Enter carrier name"
                            value={routing.carrier_name || ""}
                            onChange={(e) => {
                              const formattedValue = toTitleCase(
                                e.target.value
                              );
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_name`,
                                formattedValue
                              );
                              // For Rail, carrier_code can be same as carrier_name or empty
                              routingsForm.setFieldValue(
                                `routings.${index}.carrier_code`,
                                formattedValue
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
                          <TextInput
                            label="Rail Number"
                            required
                            placeholder="Enter rail number"
                            value={routing.rail_no || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              routingsForm.setFieldValue(
                                `routings.${index}.rail_no`,
                                value
                              );
                              // Also update flight_voyage_number for backward compatibility
                              routingsForm.setFieldValue(
                                `routings.${index}.flight_voyage_number`,
                                value
                              );
                            }}
                            error={
                              routingsForm.errors[
                                `routings.${index}.rail_no`
                              ] as string
                            }
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
                            `routings.${index}.etd`
                          );
                          return {
                            value: inputProps.value as Date | null,
                            error: inputProps.error as string | undefined,
                            onChange: (value: Date | null) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.etd`,
                                value
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
                            `routings.${index}.eta`
                          );
                          return {
                            value: inputProps.value as Date | null,
                            error: inputProps.error as string | undefined,
                            onChange: (value: Date | null) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.eta`,
                                value
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
                            `routings.${index}.atd`
                          );
                          return {
                            value: inputProps.value as Date | null,
                            error: inputProps.error as string | undefined,
                            onChange: (value: Date | null) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.atd`,
                                value
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
                            `routings.${index}.ata`
                          );
                          return {
                            value: inputProps.value as Date | null,
                            error: inputProps.error as string | undefined,
                            onChange: (value: Date | null) => {
                              routingsForm.setFieldValue(
                                `routings.${index}.ata`,
                                value
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
                            // leftSection={<IconPlus size={16} />}
                            size="lg"
                            variant="light"
                            color="#105476"
                            onClick={addRouting}
                            style={{ marginTop: "1.75rem" }}
                          >
                            <IconPlus size={16}></IconPlus>
                            {/* Add Routing */}
                          </ActionIcon>
                          {/* <ActionIcon
                            color="red"
                            variant="light"
                            size="lg"
                            onClick={() => removeRouting(index)}
                            style={{ marginTop: "1.75rem" }}
                          >
                            <IconTrash size={16} />
                          </ActionIcon> */}
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
        </Stepper.Step>

        {/* Stepper 3: Container Details */}
        <Stepper.Step label="3" description="Container Details">
          <Box mt="md">
            <Group justify="space-between" align="flex-start" mb="md">
              <Text size="lg" fw={600} c="#105476" mb="md">
                Container Details{" "}
                {containerDetailsForm.values.containers.length > 1 &&
                  `(${containerDetailsForm.values.containers.length})`}
              </Text>
              {!isReadOnly && (
                <Group gap="sm">
                  <Button
                    variant="light"
                    color="#105476"
                    leftSection={<IconPlus size={16} />}
                    onClick={addContainer}
                  >
                    Add Container
                  </Button>
                  <Button
                    variant={canSaveContainerDetails ? "filled" : "outline"}
                    color="#105476"
                    onClick={handleSaveContainerDetails}
                    disabled={!canSaveContainerDetails}
                    style={{
                      cursor: canSaveContainerDetails
                        ? "pointer"
                        : "not-allowed",
                    }}
                  >
                    Save Container
                  </Button>
                </Group>
              )}
            </Group>

            {/* Static Header Row */}
            {containerDetailsForm.values.containers.length > 0 && (
              <Grid
                mb="xs"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={2.2}>Container Type</Grid.Col>
                <Grid.Col span={2}>Container No</Grid.Col>
                <Grid.Col span={1.8}>Actual Seal No</Grid.Col>
                <Grid.Col span={1.8}>Customs Seal No</Grid.Col>
                <Grid.Col span={1.7}>Loading Date</Grid.Col>
                <Grid.Col span={1.7}>Unloading Date</Grid.Col>
                <Grid.Col span={0.5}></Grid.Col>
              </Grid>
            )}

            {/* Container Rows */}
            {containerDetailsForm.values.containers.map((_container, index) => (
              <Box key={index}>
                <Grid gutter="sm">
                  <Grid.Col span={2.2}>
                    <Dropdown
                      required
                      placeholder="Container Type"
                      searchable
                      data={containerTypeData}
                      nothingFoundMessage="No container types found"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.container_type`
                      )}
                      disabled={isReadOnly}
                      error={
                        containerDetailsForm.errors[
                          `containers.${index}.container_type`
                        ] as string
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <TextInput
                      required
                      placeholder="Container number"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.container_no`
                      )}
                      disabled={isReadOnly}
                      error={
                        containerDetailsForm.errors[
                          `containers.${index}.container_no`
                        ] as string
                      }
                      onBlur={() => {
                        // Validate uniqueness on blur
                        const currentValue =
                          containerDetailsForm.values.containers[
                            index
                          ]?.container_no?.trim();
                        if (currentValue) {
                          const duplicates =
                            containerDetailsForm.values.containers.filter(
                              (c, i) =>
                                i !== index &&
                                c.container_no?.trim() === currentValue
                            );
                          if (duplicates.length > 0) {
                            containerDetailsForm.setFieldError(
                              `containers.${index}.container_no`,
                              "Container number must be unique"
                            );
                          } else {
                            // Clear error if no duplicates
                            const currentError =
                              containerDetailsForm.errors[
                                `containers.${index}.container_no`
                              ];
                            if (
                              currentError === "Container number must be unique"
                            ) {
                              containerDetailsForm.clearFieldError(
                                `containers.${index}.container_no`
                              );
                            }
                          }
                        }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <TextInput
                      placeholder="Actual seal number"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.actual_seal_no`
                      )}
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.8}>
                    <TextInput
                      placeholder="Customs seal number"
                      {...containerDetailsForm.getInputProps(
                        `containers.${index}.customs_seal_no`
                      )}
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.7}>
                    <SingleDateInput
                      placeholder="YYYY-MM-DD"
                      value={
                        containerDetailsForm.values.containers[index]
                          ?.loading_date || null
                      }
                      onChange={(date) => {
                        containerDetailsForm.setFieldValue(
                          `containers.${index}.loading_date`,
                          date
                        );
                      }}
                      error={
                        containerDetailsForm.errors[
                          `containers.${index}.loading_date`
                        ] as string
                      }
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.7}>
                    <SingleDateInput
                      placeholder="YYYY-MM-DD"
                      value={
                        containerDetailsForm.values.containers[index]
                          ?.unloading_date || null
                      }
                      onChange={(date) => {
                        containerDetailsForm.setFieldValue(
                          `containers.${index}.unloading_date`,
                          date
                        );
                      }}
                      error={
                        containerDetailsForm.errors[
                          `containers.${index}.unloading_date`
                        ] as string
                      }
                      disabled={isReadOnly}
                    />
                  </Grid.Col>
                  <Grid.Col span={0.5}>
                    {containerDetailsForm.values.containers.length > 1 &&
                      !isReadOnly && (
                        <Button
                          variant="light"
                          color="red"
                          onClick={() => removeContainer(index)}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                  </Grid.Col>
                </Grid>
              </Box>
            ))}
          </Box>
        </Stepper.Step>

        <Stepper.Completed>
          <Text size="lg" ta="center" c="dimmed" py="xl">
            Import Job {mode === "edit" ? "updated" : "created"} successfully!
          </Text>
        </Stepper.Completed>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Group>
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() =>
              navigate("/SeaExport/import-job", {
                state: { refreshData: true },
              })
            }
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
          {!isReadOnly && active === 2 && (
            <Tooltip
              label="Please enter Container Type and Container Number in at least one row to enable Add HBL"
              disabled={canAddHBL}
              withArrow
            >
              <Button
                variant="outline"
                color="#105476"
                leftSection={<IconPlus size={16} />}
                onClick={() => navigateToHouseCreate()}
                disabled={!canAddHBL}
                style={{
                  cursor: canAddHBL ? "pointer" : "not-allowed",
                }}
              >
                Add HBL
              </Button>
            </Tooltip>
          )}
          {active === 0 && !isReadOnly && (
            <Button
              rightSection={<IconChevronRight size={16} />}
              color="#105476"
              onClick={handleNext}
              loading={isSubmitting}
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
        </Group>
      </Group>
      {/* Housing Details Display - Show at the top */}
      {housingDetails.length > 0 && active === 2 && (
        <Box mb="xl">
          <Text size="lg" fw={600} c="#105476" mb="md" mt="md">
            House Bill of Lading ({housingDetails.length})
          </Text>
          <Stack gap="md">
            {housingDetails.map((house, index) => (
              <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" align="flex-start" mb="md">
                  <Group>
                    <Badge color="#105476" size="lg">
                      HBL {index + 1}
                    </Badge>
                    <Badge
                      color={
                        house.routed === "self" || house.routed === "agent"
                          ? "green"
                          : "gray"
                      }
                      variant="light"
                    >
                      {house.routed === "self"
                        ? "Self"
                        : house.routed === "agent"
                          ? "Agent"
                          : "Not Routed"}
                    </Badge>
                    {house.routed_by && (
                      <Badge color="blue" variant="light" ml="xs">
                        Routed By : {house.routed_by}
                      </Badge>
                    )}
                    {/* <Badge color="blue" variant="light">
                      {house.trade}
                    </Badge> */}
                  </Group>
                  {!isReadOnly && (
                    <Group gap="xs">
                      <Button
                        variant="light"
                        color="#105476"
                        size="xs"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleEditHousingDetail(index)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => removeHousingDetail(index)}
                      >
                        Remove
                      </Button>
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="light" color="#105476" size="lg">
                            <IconDotsVertical size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEye size={14} />}
                            onClick={() =>
                              generateCargoArrivalNoticePDFPreview(house)
                            }
                          >
                            Cargo Arrival Notice
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconEye size={14} />}
                            onClick={() =>
                              generateDeliveryOrderPDFPreview(house)
                            }
                          >
                            Delivery Order
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  )}
                </Group>

                <Grid>
                  {/* <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Shipment ID
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.shipment_id || "-"}
                    </Text>
                  </Grid.Col> */}

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      HBL Number
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.hbl_number || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Origin
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.origin_name && house.origin_code
                        ? `${house.origin_name} (${house.origin_code})`
                        : house.origin_code || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Destination
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.destination_name && house.destination_code
                        ? `${house.destination_name} (${house.destination_code})`
                        : house.destination_code || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={2}>
                    <Text size="sm" fw={500} c="dimmed">
                      Customer Service
                    </Text>
                    <Text size="sm" mb="sm">
                      {house.customer_service || "-"}
                    </Text>
                  </Grid.Col>

                  {/* <Grid.Col span={12}>
                    <Divider my="sm" />
                  </Grid.Col>

                  <Grid.Col span={4}>
                    <Text size="sm" fw={600} c="#105476" mb="xs">
                      Destination Agent
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Name
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.destination_agent_name || "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.destination_agent_email || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={4}>
                    <Text size="sm" fw={600} c="#105476" mb="xs">
                      Shipper
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Name
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.shipper_name || "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.shipper_email || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={4}>
                    <Text size="sm" fw={600} c="#105476" mb="xs">
                      Consignee
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Name
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.consignee_name || "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.consignee_email || "-"}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={12}>
                    <Text size="sm" fw={600} c="#105476" mb="xs">
                      Notify Customer
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Name
                    </Text>
                    <Text size="sm" mb="xs">
                      {house.notify_customer1_name || "-"}
                    </Text>
                    <Text size="sm" fw={500} c="dimmed">
                      Email
                    </Text>
                    <Text size="sm">{house.notify_customer1_email || "-"}</Text>
                  </Grid.Col> */}
                </Grid>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* PDF Preview Modal */}
      <Modal
        opened={previewOpen}
        onClose={handleClosePreview}
        title={`Cargo Arrival Notice - ${currentHousingForPreview?.hbl_number || "HBL"}`}
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

      {/* Delivery Order PDF Preview Modal */}
      <Modal
        opened={doPreviewOpen}
        onClose={handleCloseDoPreview}
        title={`Delivery Order - ${currentHousingForDoPreview?.hbl_number || "HBL"}`}
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
    </Box>
  );
}

export default ImportJobCreate;
