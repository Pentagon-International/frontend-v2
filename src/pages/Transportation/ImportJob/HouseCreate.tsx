import {
  Box,
  Button,
  Grid,
  Group,
  Stepper,
  Text,
  TextInput,
  Textarea,
  Badge,
  ActionIcon,
  Menu,
  Modal,
  Loader,
  Center,
  Stack,
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
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import {
  SearchableSelect,
  Dropdown,
  ToastNotification,
} from "../../../components";
import { toTitleCase } from "../../../utils/textFormatter";
import { generateCargoArrivalNoticePDF } from "../../jobs/pdf/CargoArrivalNoticePDFTemplate";
import { generateDeliveryOrderPDF } from "../../jobs/pdf/DeliveryOrderPDFTemplate";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import useAuthStore from "../../../store/authStore";
import { NumberInput } from "@mantine/core";

// Type definitions
type HouseDetailsForm = {
  hbl_number: string;
  routed: string;
  routed_by: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  customer_service: string;
  trade: string;
  origin_agent: string; // Stores customer_code (code) for API payload
  origin_agent_name: string; // Stores customer_name (name) for display
  origin_agent_address: string;
  origin_agent_email: string;
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
  commodity_description: string;
  marks_no: string;
};

// Type definitions for cargo details
type CargoDetail = {
  id?: number | string; // ID from backend when editing
  container_number: string; // UI field - used to select container
  container_id?: number | string; // Container ID for edit mode (from container_details)
  no_of_packages: number | null;
  gross_weight: number | null;
  volume: number | null;
  chargeable_weight: number | null;
  haz: boolean | null;
};

// Type definitions for charges
type ChargeDetail = {
  id?: number | string; // ID from backend when editing
  charge_name: string;
  pp_cc: string;
  unit_code: string;
  no_of_unit: number | null;
  currency: string;
  roe: number | null;
  amount_per_unit: number | null;
  amount: number | null;
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
        service_type: "SEA",
      },
    };
    const response = (await postAPICall(
      URL.unitMasterFilter,
      payload,
      API_HEADER
    )) as { data?: unknown[] };
    return response?.data || [];
  } catch (error) {
    console.error("Error fetching unit master:", error);
    return [];
  }
};

// Validation handled in validateStep1 and validateStep2 functions

function HouseCreate() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Helper function to calculate ROE based on currency and user's country
  const getRoeValue = useCallback(
    (currency: string): number => {
      const userCountryCode = user?.country?.country_code;
      const currencyUpper = currency?.toUpperCase();

      if (userCountryCode === "IN") {
        if (currencyUpper === "INR") return 1;
        if (currencyUpper === "USD") return 88.75;
      } else if (userCountryCode === "AE") {
        if (currencyUpper === "AED") return 1;
        if (currencyUpper === "USD") return 3.67;
      }

      return 1;
    },
    [user?.country?.country_code]
  );

  // Calculate chargeable weight: Max of (Gross Weight ÷ 1000) and Volume
  const calculateChargeableWeight = useCallback(
    (grossWeight: number | null, volume: number | null): number => {
      if (!grossWeight && !volume) return 0;

      const grossWeightInCbm = grossWeight ? grossWeight / 1000 : 0;
      const volumeInCbm = volume || 0;

      return Math.max(grossWeightInCbm, volumeInCbm);
    },
    []
  );

  // State for address options (populated from addresses_data when shipper/consignee is selected)
  const [shipperAddressOptions, setShipperAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [consigneeAddressOptions, setConsigneeAddressOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  // State for cargo details
  const [cargoDetails, setCargoDetails] = useState<CargoDetail[]>([
    {
      container_number: "",
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

  // Charges Form - Using useForm similar to routings in ImportJobCreate
  const chargesForm = useForm<{ charges: ChargeDetail[] }>({
    initialValues: {
      charges: [
        {
          id: undefined,
          charge_name: "",
          pp_cc: "",
          unit_code: "",
          no_of_unit: null,
          currency: "",
          roe: null,
          amount_per_unit: null,
          amount: null,
        },
      ],
    },
  });

  // Get existing housing details from location state if available
  const existingHousingDetails = location.state?.housingDetails || [];
  const editIndex = location.state?.editIndex;
  const editData = location.state?.editData;
  const isEditMode = editIndex !== undefined && editData !== undefined;
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
                container.container_no === containerNumber
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
              no_of_packages: cargo.no_of_packages as number | null,
              gross_weight: cargo.gross_weight as number | null,
              volume: cargo.volume as number | null,
              chargeable_weight: cargo.chargeable_weight as number | null,
              haz:
                cargo.haz !== null && cargo.haz !== undefined
                  ? typeof cargo.haz === "boolean"
                    ? cargo.haz
                    : cargo.haz === "Yes" || cargo.haz === true
                  : null,
            };
          }
        );
        setCargoDetails(mappedCargoDetails);
      }

      // Load charges - check both charges and mbl_charges
      // mbl_charges is the field name in the API response, charges is used internally
      const chargesToLoad = editData.charges || editData.mbl_charges;
      if (
        chargesToLoad &&
        Array.isArray(chargesToLoad) &&
        chargesToLoad.length > 0
      ) {
        const mappedCharges = chargesToLoad.map(
          (charge: Record<string, unknown>) => {
            // Handle mbl_charges structure: unit can be in charge.unit or charge.unit_details.unit_code
            const unitCode = charge.unit_code
              ? String(charge.unit_code)
              : charge.unit
                ? String(charge.unit)
                : (charge.unit_details as Record<string, unknown>)?.unit_code
                  ? String(
                      (charge.unit_details as Record<string, unknown>).unit_code
                    )
                  : "";

            // Handle currency: can be in charge.currency or charge.currency_details.currency_code
            const currencyCode = charge.currency
              ? String(charge.currency)
              : (charge.currency_details as Record<string, unknown>)
                    ?.currency_code
                ? String(
                    (charge.currency_details as Record<string, unknown>)
                      .currency_code
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
              charge.amount !== null && charge.amount !== undefined
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
              charge_name: charge.charge_name ? String(charge.charge_name) : "",
              pp_cc: charge.pp_cc ? String(charge.pp_cc) : "",
              unit_code: unitCode,
              no_of_unit:
                charge.no_of_unit !== null && charge.no_of_unit !== undefined
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
        );
        chargesForm.setValues({ charges: mappedCharges });
      }

      // Set shipper_code and consignee_code if available in editData
      if (editData.shipper_code) {
        form.setFieldValue("shipper_code", String(editData.shipper_code));
      }
      if (editData.consignee_code) {
        form.setFieldValue("consignee_code", String(editData.consignee_code));
      }
      // Set origin_agent (code) and origin_agent_name if available in editData
      // Note: editData may not have origin_agent_code, but we can try to get it from the name
      // For now, we'll set origin_agent_name from editData
      // The user will need to re-select the agent to get the code, or we can try to find it
      if (editData.origin_agent_name) {
        form.setFieldValue(
          "origin_agent_name",
          String(editData.origin_agent_name)
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, editData]);

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

  // Form with all fields - pre-fill if in edit mode, auto-set from MBL in create mode
  const form = useForm<HouseDetailsForm>({
    initialValues: {
      hbl_number: editData?.hbl_number || "",
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
      origin_agent: "", // Will be set from editData or MBL details if available
      origin_agent_name: editData?.origin_agent_name || "",
      origin_agent_address: editData?.origin_agent_address || "",
      origin_agent_email: editData?.origin_agent_email || "",
      shipper_code: "", // Will be set when user selects from SearchableSelect
      shipper_name: editData?.shipper_name || "",
      shipper_address: editData?.shipper_address || "",
      shipper_email: editData?.shipper_email || "",
      consignee_code: "", // Will be set when user selects from SearchableSelect
      consignee_name: editData?.consignee_name || "",
      consignee_address: editData?.consignee_address || "",
      consignee_email: editData?.consignee_email || "",
      notify_customer1_name: editData?.notify_customer1_name || "",
      notify_customer1_address: editData?.notify_customer1_address || "",
      notify_customer1_email: editData?.notify_customer1_email || "",
      commodity_description: editData?.commodity_description || "",
      marks_no: editData?.marks_no || "",
    },
    validate: () => {
      // Validation handled in validateStep functions
      return {};
    },
  });

  // Memoize additionalParams to prevent SearchableSelect from recreating fetchData on every render
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  // Auto-calculate chargeable weight when gross weight or volume changes
  const cargoGrossWeights = cargoDetails.map((c) => c.gross_weight).join(",");
  const cargoVolumes = cargoDetails.map((c) => c.volume).join(",");

  useEffect(() => {
    const updatedCargoDetails = cargoDetails.map((cargo) => {
      const chargeableWeight = calculateChargeableWeight(
        cargo.gross_weight,
        cargo.volume
      );
      // Only update if chargeable_weight changed
      if (cargo.chargeable_weight === chargeableWeight) {
        return cargo;
      }
      return {
        ...cargo,
        chargeable_weight: chargeableWeight > 0 ? chargeableWeight : null,
      };
    });

    // Only update if there are actual changes
    const hasChanges = updatedCargoDetails.some(
      (cargo, index) =>
        cargo.chargeable_weight !== cargoDetails[index]?.chargeable_weight
    );

    if (hasChanges) {
      setCargoDetails(updatedCargoDetails);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargoGrossWeights, cargoVolumes, calculateChargeableWeight]);

  // Auto-set ROE when currency changes (but don't auto-calculate amount)
  const chargeCurrencies = chargesForm.values.charges
    .map((c) => c.currency)
    .join(",");

  useEffect(() => {
    const updatedCharges = chargesForm.values.charges.map((charge) => {
      // Auto-set ROE if currency is selected but ROE is not set
      let roe = charge.roe;
      if (charge.currency && !roe) {
        roe = getRoeValue(charge.currency);
      }

      // Only update ROE, don't touch amount
      if (roe !== charge.roe) {
        return {
          ...charge,
          roe: roe || null,
        };
      }

      return charge;
    });

    // Only update if there are actual changes to ROE
    const hasChanges = updatedCharges.some(
      (charge, index) => charge.roe !== chargesForm.values.charges[index]?.roe
    );

    if (hasChanges) {
      chargesForm.setValues({ charges: updatedCharges });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCurrencies, getRoeValue]);

  // Auto-calculate amount when amount_per_unit, roe, or no_of_unit changes
  // Formula: amount = roe * no_of_unit * amount_per_unit (only if amount_per_unit is given)
  const chargeCalculationKeys = chargesForm.values.charges
    .map(
      (c) => `${c.roe || ""}_${c.no_of_unit || ""}_${c.amount_per_unit || ""}`
    )
    .join(",");

  useEffect(() => {
    const updatedCharges = chargesForm.values.charges.map((charge) => {
      // Only calculate if amount_per_unit is provided
      if (
        charge.amount_per_unit !== null &&
        charge.amount_per_unit !== undefined &&
        charge.amount_per_unit > 0
      ) {
        const roe =
          charge.roe !== null && charge.roe !== undefined ? charge.roe : 0;
        const noOfUnit =
          charge.no_of_unit !== null && charge.no_of_unit !== undefined
            ? charge.no_of_unit
            : 0;
        const amountPerUnit = charge.amount_per_unit;

        // Calculate: amount = roe * no_of_unit * amount_per_unit
        const calculatedAmount = roe * noOfUnit * amountPerUnit;

        // Only update if the calculated value is different from current amount
        // This allows user to manually edit the amount after calculation
        if (calculatedAmount !== charge.amount) {
          return {
            ...charge,
            amount: calculatedAmount > 0 ? calculatedAmount : null,
          };
        }
      }

      return charge;
    });

    // Only update if there are actual changes to amount
    const hasChanges = updatedCharges.some(
      (charge, index) =>
        charge.amount !== chargesForm.values.charges[index]?.amount
    );

    if (hasChanges) {
      chargesForm.setValues({ charges: updatedCharges });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeCalculationKeys]);

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

  // Unit master query
  const { data: unitDataRaw = [] } = useQuery({
    queryKey: ["unitMaster", "SEA"],
    queryFn: fetchUnitMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Format currency data
  const currencyOptions = useMemo(() => {
    if (!Array.isArray(currencyData)) return [];
    return currencyData.map((item: { code?: string }) => ({
      value: String(item.code || ""),
      label: item.code || "",
    }));
  }, [currencyData]);

  // Format unit data
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

  // Format container numbers from location state into dropdown options
  const containerNumberOptions = useMemo(() => {
    const containerNumbers = location.state?.containerNumbers || [];
    if (!Array.isArray(containerNumbers)) return [];
    return containerNumbers
      .filter((no) => no && String(no).trim() !== "")
      .map((no) => ({
        value: String(no),
        label: String(no),
      }));
  }, [location.state?.containerNumbers]);

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
        form.values.trade
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

  // Auto-update HBL origin agent name and address from MBL origin agent
  // This runs in both create and edit mode to ensure origin_agent (code) is set from MBL if available
  useEffect(() => {
    const mblDetails = location.state?.mblDetails;
    if (!mblDetails) return;

    const mblOriginAgent = mblDetails.origin_agent || ""; // This is the customer_code
    const mblOriginAgentName = mblDetails.origin_agent_name || ""; // This is the customer_name
    const mblOriginAgentData = mblDetails.origin_agent_data as
      | Record<string, unknown>
      | null
      | undefined;

    console.log("🔍 MBL Origin Agent Auto-fill:", {
      mblOriginAgent,
      mblOriginAgentName,
      hasMblOriginAgentData: !!mblOriginAgentData,
      mblOriginAgentData,
      addressesData: mblOriginAgentData?.addresses_data,
      fullMblDetails: mblDetails,
      isEditMode,
      currentOriginAgent: form.values.origin_agent,
      currentOriginAgentName: form.values.origin_agent_name,
    });

    // In create mode: always set from MBL if available
    // In edit mode: only set if not already set (to preserve user edits)
    if (mblOriginAgent && mblOriginAgent.trim() !== "") {
      // Auto-set HBL origin agent code from MBL origin agent (code)
      // Only set if not already set in edit mode, or always in create mode
      if (!isEditMode || !form.values.origin_agent) {
        form.setFieldValue("origin_agent", mblOriginAgent);
      }
      // Auto-set HBL origin agent name from MBL origin agent name
      if (mblOriginAgentName && mblOriginAgentName.trim() !== "") {
        // Only set if not already set in edit mode, or always in create mode
        if (!isEditMode || !form.values.origin_agent_name) {
          form.setFieldValue("origin_agent_name", mblOriginAgentName);
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
          if (!isEditMode || !form.values.origin_agent_name) {
            form.setFieldValue("origin_agent_name", customerName);
          }
        }
      }

      // Auto-set HBL origin agent address from MBL
      // Priority: 1. mblDetails.origin_agent_address (direct field), 2. addresses_data from origin_agent_data
      const mblOriginAgentAddress = mblDetails.origin_agent_address as
        | string
        | undefined;

      if (mblOriginAgentAddress && mblOriginAgentAddress.trim() !== "") {
        // Use direct origin_agent_address field from mblDetails if available
        // Only set if not already set in edit mode, or always in create mode
        if (!isEditMode || !form.values.origin_agent_address) {
          console.log(
            "✅ Setting HBL origin agent address from mblDetails.origin_agent_address:",
            mblOriginAgentAddress
          );
          form.setFieldValue("origin_agent_address", mblOriginAgentAddress);
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
          if (!isEditMode || !form.values.origin_agent_address) {
            console.log(
              "✅ Setting HBL origin agent address from addresses_data:",
              firstAddress
            );
            form.setFieldValue("origin_agent_address", firstAddress);
          }
        } else {
          console.log("⚠️ No valid address found in addresses_data");
          // Clear address if no addresses_data available (only in create mode)
          if (!isEditMode) {
            form.setFieldValue("origin_agent_address", "");
          }
        }
      } else {
        console.log("⚠️ No mblOriginAgentData or addresses_data found");
        // Clear address if no origin_agent_data (only in create mode)
        if (!isEditMode) {
          form.setFieldValue("origin_agent_address", "");
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
      form.values.notify_customer1_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.notify_customer1_email)
    ) {
      errors.notify_customer1_email = "Invalid email format";
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

  // Validate step 4 - Charges
  // Mandatory validations apply to both create and edit modes
  const validateStep4 = () => {
    const newErrors: Record<number, Record<string, string>> = {};
    let hasErrors = false;

    chargesForm.values.charges.forEach((charge, index) => {
      const chargeError: Record<string, string> = {};

      // Mandatory fields: charge_name, pp_cc, currency, roe, amount
      if (!charge.charge_name || charge.charge_name.trim() === "") {
        chargeError.charge_name = "Charge Name is required";
        hasErrors = true;
      }
      if (!charge.pp_cc || charge.pp_cc.trim() === "") {
        chargeError.pp_cc = "PP/CC is required";
        hasErrors = true;
      }
      if (!charge.currency || charge.currency.trim() === "") {
        chargeError.currency = "Currency is required";
        hasErrors = true;
      }
      if (charge.roe === null || charge.roe === undefined) {
        chargeError.roe = "ROE is required";
        hasErrors = true;
      }
      if (charge.amount === null || charge.amount === undefined) {
        chargeError.amount = "Amount is required";
        hasErrors = true;
      }
      // If amount_per_unit or no_of_unit is set, both should be set
      if (
        (charge.amount_per_unit && !charge.no_of_unit) ||
        (charge.no_of_unit && !charge.amount_per_unit)
      ) {
        chargeError.amount_per_unit =
          "Both Amount Per Unit and No of Unit must be set together";
        hasErrors = true;
      }

      if (Object.keys(chargeError).length > 0) {
        newErrors[index] = chargeError;
      }
    });

    setChargeErrors(newErrors);

    if (hasErrors) {
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

  // Handle save - navigate to ImportJobCreate with housing details
  const handleSave = () => {
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
        no_of_packages,
        gross_weight,
        volume,
        chargeable_weight,
        haz,
      } = cargo as any;

      // Try to find matching container object (from containerDetails) by container_no
      const matchedContainer = containerDetails.find(
        (c: Record<string, unknown>) =>
          c.container_no === container_number ||
          // Also allow matching by index if containerNumbers are aligned
          (Array.isArray(containerNumbers) &&
            containerNumbers[idx] === container_number)
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
        gross_weight: gross_weight ?? null,
        volume: volume ?? null,
        chargeable_weight: chargeable_weight ?? null,
        haz: hazValue,
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

    // Prepare charges payload - include id only in edit mode
    const chargesForPayload = chargesForm.values.charges.map((charge) => ({
      // Include id only in edit mode
      ...(isEditMode &&
        charge.id && {
          id: typeof charge.id === "number" ? charge.id : Number(charge.id),
        }),
      charge_name: charge.charge_name,
      pp_cc: charge.pp_cc,
      unit_code: charge.unit_code,
      no_of_unit: charge.no_of_unit,
      currency: charge.currency,
      roe: charge.roe,
      amount_per_unit: charge.amount_per_unit,
      amount: charge.amount,
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
      consignee_name: form.values.consignee_name,
      consignee_address: form.values.consignee_address,
      consignee_email: form.values.consignee_email,
      notify_customer1_name: form.values.notify_customer1_name,
      notify_customer1_address: form.values.notify_customer1_address,
      notify_customer1_email: form.values.notify_customer1_email,
      commodity_description: form.values.commodity_description,
      marks_no: form.values.marks_no,
      cargo_details: cargoDetailsForPayload,
      charges: chargesForPayload,
    };

    // Update existing housing details
    let updatedHousingDetails: typeof existingHousingDetails;

    if (isEditMode && editIndex !== undefined) {
      // Deep clone existing list (prevents stale nested references)
      updatedHousingDetails = JSON.parse(
        JSON.stringify(existingHousingDetails)
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

    // Determine navigation path based on edit mode
    const isInEditMode = location.state?.job && location.state.job.id;
    const navigatePath = isInEditMode
      ? "/SeaExport/import-job/edit"
      : "/SeaExport/import-job/create";

    // Navigate to ImportJobCreate with housing details
    navigate(navigatePath, {
      state: {
        fromHouseCreate: true,
        housingDetails: updatedHousingDetails,
        ...(location.state?.job && { job: location.state.job }),
        // Only send these back in CREATE MODE
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
      },
    });
  };

  // Generate PDF preview from current form data
  const generatePDFPreview = () => {
    try {
      setPreviewOpen(true);

      // Get default branch from user store or use default
      const defaultBranch = user?.branches?.find(
        (branch) => branch.is_default
      ) ||
        user?.branches?.[0] || { branch_name: "CHENNAI" };
      const country = user?.country || null;

      // Build housing data from current form
      const housingData = {
        hbl_number: form.values.hbl_number,
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
        consignee_name: form.values.consignee_name,
        consignee_address: form.values.consignee_address,
        consignee_email: form.values.consignee_email,
        notify_customer1_name: form.values.notify_customer1_name,
        notify_customer1_address: form.values.notify_customer1_address,
        notify_customer1_email: form.values.notify_customer1_email,
        commodity_description: form.values.commodity_description,
        marks_no: form.values.marks_no,
        cargo_details: cargoDetails.map((cargo) => ({
          no_of_packages: cargo.no_of_packages,
          gross_weight: cargo.gross_weight,
          volume: cargo.volume,
          chargeable_weight: cargo.chargeable_weight,
          haz: cargo.haz === true || cargo.haz === "Yes",
        })),
        mbl_charges: chargesForm.values.charges
          .filter((charge) => charge.charge_name)
          .map((charge) => ({
            charge_name: charge.charge_name,
            pp_cc: charge.pp_cc,
            unit: charge.unit_code,
            currency: charge.currency,
            no_of_unit: charge.no_of_unit,
            roe: charge.roe,
            amount_per_unit: charge.amount_per_unit,
            amount: charge.amount,
          })),
      };

      // Build job data from location state
      const jobData = {
        service: location.state?.mblDetails?.service || "FCL",
        service_type: "Import",
        ...location.state?.mblDetails,
        ...location.state?.carrierDetails,
        notes: location.state?.job?.notes || [],
      };

      const blobUrl = generateCargoArrivalNoticePDF(
        jobData,
        housingData,
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

  // Generate Delivery Order PDF Preview
  const generateDeliveryOrderPDFPreview = async () => {
    try {
      setDoPreviewOpen(true);

      // Combine job data and current HBL form data for PDF generation
      const combinedData = {
        ...location.state?.job, // Job-level data
        ...form.values, // Current HBL form data
        mawbDetails: location.state?.mblDetails, // MBL details from parent
        carrierDetails: location.state?.carrierDetails, // Carrier details from parent
        containerDetails: location.state?.containerDetails || [],
      };

      const blobUrl = generateDeliveryOrderPDF(combinedData, form.values);
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
    if (doPdfBlob) {
      window.URL.revokeObjectURL(doPdfBlob);
    }
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
    <Box p="md" maw={1200} mx="auto">
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600} c="#105476">
          {isEditMode ? "Edit HBL Details" : "Create HBL Details"}
        </Text>
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
              if (active === 3) {
                if (validateStep4()) {
                  handleSave();
                }
              } else {
                handleNext();
              }
            }}
          >
            Save HBL
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
                onClick={generatePDFPreview}
              >
                Cargo Arrival Notice
              </Menu.Item>
              <Menu.Item
                leftSection={<IconEye size={14} />}
                onClick={generateDeliveryOrderPDFPreview}
              >
                Delivery Order
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Stepper
        color="#105476"
        active={active}
        onStepClick={setActive}
        orientation="horizontal"
      >
        {/* Stepper 1: Basic Details */}
        <Stepper.Step label="1" description="Shipment Details">
          <Group align="center" mb="xs">
            <Text size="lg" fw={600} c="#105476">
              Shipment Details
            </Text>
            {isEditMode && editData?.shipment_id && (
              <Badge color="#105476" size="lg" variant="light">
                Shipment ID: {editData.shipment_id}
              </Badge>
            )}
          </Group>

          <Box mt="md">
            <Grid>
              <Grid.Col span={4}>
                <TextInput
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
                  placeholder="Type origin code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
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
                        selectedData.label.split(" (")[0] || ""
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
                  placeholder="Type destination code or name"
                  searchFields={["port_code", "port_name"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.port_code),
                    label: `${item.port_name} (${item.port_code})`,
                  })}
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
                        selectedData.label.split(" (")[0] || ""
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
                        form.values.trade
                      );
                    } else if (!hblDestinationCode) {
                      // Clear trade if HBL destination is cleared
                      console.log("🧹 Clearing Trade (no HBL destination)");
                      form.setFieldValue("trade", "");
                    } else {
                      console.log(
                        "⚠️ No MBL destination found, cannot update Trade"
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
                      value
                    );
                    form.setFieldValue("trade", value || "");
                    console.log(
                      "📝 Trade Dropdown after setFieldValue, form.values.trade:",
                      form.values.trade
                    );
                  }}
                  error={form.errors.trade}
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
                    <TextInput
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
                  <TextInput
                    label="Routed By"
                    required
                    placeholder="Enter routed by"
                    {...form.getInputProps("routed_by")}
                    error={form.errors.routed_by}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
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
            </Grid>
          </Box>
        </Stepper.Step>

        {/* Stepper 2: Agent & Customer Details */}
        <Stepper.Step label="2" description="Party Details">
          <Box mt="md">
            {/* Shipper Section */}
            <Text size="lg" fw={600} c="#105476" mb="xs">
              Shipper
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Shipper Name"
                  required
                  placeholder="Type shipper name"
                  apiEndpoint={URL.shipper}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code),
                    label: String(item.customer_name),
                  })}
                  value={form.values.shipper_code}
                  displayValue={form.values.shipper_name}
                  onChange={(value, selectedData, originalData) => {
                    form.setFieldValue("shipper_code", value || "");
                    form.setFieldValue(
                      "shipper_name",
                      selectedData?.label || ""
                    );

                    // Use originalData to populate address options
                    if (
                      value &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      // Create address options from addresses_data
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
                        })
                      );

                      setShipperAddressOptions(addressOptions);

                      // Auto-select the first address if available
                      if (
                        addressesData.length > 0 &&
                        addressesData[0].address
                      ) {
                        form.setFieldValue(
                          "shipper_address",
                          addressesData[0].address
                        );
                      } else {
                        form.setFieldValue("shipper_address", "");
                      }
                    } else {
                      setShipperAddressOptions([]);
                      form.setFieldValue("shipper_address", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.shipper_name as string}
                  minSearchLength={3}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Shipper Email"
                  type="email"
                  placeholder="Enter Shipper Email"
                  {...form.getInputProps("shipper_email")}
                  error={form.errors.shipper_email}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Dropdown
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
                  disabled={shipperAddressOptions.length === 0}
                />
              </Grid.Col>
            </Grid>

            {/* Consignee Section */}
            <Text size="lg" fw={600} c="#105476" mb="xs">
              Consignee
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                <SearchableSelect
                  label="Consignee Name"
                  required
                  placeholder="Type consignee name"
                  apiEndpoint={URL.consignee}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code),
                    label: String(item.customer_name),
                  })}
                  value={form.values.consignee_code}
                  displayValue={form.values.consignee_name}
                  onChange={(value, selectedData, originalData) => {
                    form.setFieldValue("consignee_code", value || "");
                    form.setFieldValue(
                      "consignee_name",
                      selectedData?.label || ""
                    );

                    // Use originalData to populate address options
                    if (
                      value &&
                      originalData &&
                      (originalData as Record<string, unknown>).addresses_data
                    ) {
                      // Create address options from addresses_data
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
                        })
                      );

                      setConsigneeAddressOptions(addressOptions);

                      // Auto-select the first address if available
                      if (
                        addressesData.length > 0 &&
                        addressesData[0].address
                      ) {
                        form.setFieldValue(
                          "consignee_address",
                          addressesData[0].address
                        );
                      } else {
                        form.setFieldValue("consignee_address", "");
                      }
                    } else {
                      setConsigneeAddressOptions([]);
                      form.setFieldValue("consignee_address", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.consignee_name as string}
                  minSearchLength={3}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Consignee Email"
                  type="email"
                  placeholder="Enter Consignee Email"
                  {...form.getInputProps("consignee_email")}
                  error={form.errors.consignee_email}
                />
              </Grid.Col>
              <Grid.Col span={4}>
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
                  disabled={consigneeAddressOptions.length === 0}
                />
              </Grid.Col>
            </Grid>

            {/* Notify Customer Section */}
            <Text size="lg" fw={600} c="#105476" mb="xs">
              Notify Customer
            </Text>
            <Grid mb="xs">
              <Grid.Col span={4}>
                <TextInput
                  label="Notify Customer Name"
                  placeholder="Enter Notify Customer Name"
                  {...form.getInputProps("notify_customer1_name")}
                  error={form.errors.notify_customer1_name}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Notify Customer Email"
                  type="email"
                  placeholder="Enter Notify Customer Email"
                  {...form.getInputProps("notify_customer1_email")}
                  error={form.errors.notify_customer1_email}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Textarea
                  label="Notify Customer Address"
                  placeholder="Enter Notify Customer Address"
                  minRows={2}
                  value={form.values.notify_customer1_address}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.currentTarget.value);
                    form.setFieldValue(
                      "notify_customer1_address",
                      formattedValue
                    );
                  }}
                  error={form.errors.notify_customer1_address}
                />
              </Grid.Col>
            </Grid>
            {/* Origin Agent Section */}
            <Text size="lg" fw={600} c="#105476" mb="xs">
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
                    value: String(item.customer_code), // Use code as value for API payload
                    label: String(item.customer_name), // Display name to user
                  })}
                  value={form.values.origin_agent} // Stores customer_code
                  displayValue={form.values.origin_agent_name} // Displays customer_name
                  onChange={(value, selectedData, originalData) => {
                    // Store customer_code as value (for API payload)
                    form.setFieldValue("origin_agent", value || "");
                    // Store customer_name for display
                    form.setFieldValue(
                      "origin_agent_name",
                      selectedData?.label || ""
                    );

                    // Auto-fill address from addresses_data if available
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
                        addressesData.length > 0 &&
                        addressesData[0].address
                      ) {
                        form.setFieldValue(
                          "origin_agent_address",
                          addressesData[0].address
                        );
                      } else {
                        form.setFieldValue("origin_agent_address", "");
                      }
                    } else {
                      form.setFieldValue("origin_agent_address", "");
                    }
                  }}
                  returnOriginalData={true}
                  error={form.errors.origin_agent_name as string}
                  minSearchLength={2}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Origin Agent Email"
                  type="email"
                  placeholder="Enter Origin Agent Email"
                  {...form.getInputProps("origin_agent_email")}
                  error={form.errors.origin_agent_email}
                />
              </Grid.Col>

              <Grid.Col span={4}>
                <Textarea
                  label="Origin Agent Address"
                  placeholder="Enter Origin Agent Address"
                  minRows={2}
                  value={form.values.origin_agent_address}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.currentTarget.value);
                    form.setFieldValue("origin_agent_address", formattedValue);
                  }}
                  error={form.errors.origin_agent_address}
                />
              </Grid.Col>
            </Grid>
          </Box>
        </Stepper.Step>

        {/* Stepper 3: Cargo Details */}
        <Stepper.Step label="3" description="Cargo Details">
          <Box mt="md">
            <Text size="lg" fw={600} c="#105476" mb="md">
              Cargo Details{" "}
              {cargoDetails.length > 1 && `(${cargoDetails.length})`}
            </Text>

            <Grid mb="md">
              <Grid.Col span={6}>
                <Textarea
                  label="Commodity Description"
                  placeholder="Enter Commodity Description"
                  minRows={3}
                  value={form.values.commodity_description}
                  onChange={(e) => {
                    const formattedValue = toTitleCase(e.currentTarget.value);
                    form.setFieldValue("commodity_description", formattedValue);
                  }}
                  error={form.errors.commodity_description}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Textarea
                  label="Marks No"
                  placeholder="Enter Marks No"
                  minRows={3}
                  {...form.getInputProps("marks_no")}
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
                  Container Number{" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                <Grid.Col span={1.5}>
                  No of Packages{" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                <Grid.Col span={2}>
                  Gross Weight (KG){" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                <Grid.Col span={2}>
                  Volume (CBM){" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                <Grid.Col span={2}>Chargeable Weight (CBM)</Grid.Col>
                <Grid.Col span={1.5}>Haz</Grid.Col>
                {/* <Grid.Col span={1.5}>Actions</Grid.Col> */}
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
                            container.container_no === value
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
                  <Grid.Col span={1.5}>
                    <NumberInput
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
                  <Grid.Col span={2}>
                    <NumberInput
                      placeholder="Enter Gross Weight"
                      min={0}
                      hideControls
                      value={cargo.gross_weight || undefined}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          gross_weight: value as number | null,
                        };
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
                      error={cargoErrors[index]?.gross_weight}
                    />
                  </Grid.Col>
                  <Grid.Col span={2}>
                    <NumberInput
                      placeholder="Enter Volume"
                      min={0}
                      hideControls
                      value={cargo.volume || undefined}
                      onChange={(value) => {
                        const updated = [...cargoDetails];
                        updated[index] = {
                          ...updated[index],
                          volume: value as number | null,
                        };
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
                      error={cargoErrors[index]?.volume}
                    />
                  </Grid.Col>
                  <Grid.Col span={2}>
                    <NumberInput
                      placeholder=""
                      hideControls
                      value={cargo.chargeable_weight || undefined}
                      readOnly
                      disabled
                      styles={{
                        input: {
                          backgroundColor: "#f5f5f5",
                        },
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.5}>
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
                  <Grid.Col span={1.5}>
                    <Group gap="xs">
                      {cargoDetails.length > 1 && (
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={() => {
                            const updated = cargoDetails.filter(
                              (_, i) => i !== index
                            );
                            setCargoDetails(updated);
                          }}
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                      {cargoDetails.length - 1 === index && (
                        <Button
                          size="xs"
                          variant="light"
                          color="#105476"
                          onClick={() => {
                            setCargoDetails([
                              ...cargoDetails,
                              {
                                container_number: "",
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
        </Stepper.Step>

        {/* Stepper 4: Charges */}
        <Stepper.Step label="4" description="Charges">
          <Box mt="md">
            <Text size="lg" fw={600} c="#105476" mb="md">
              Charges{" "}
              {chargesForm.values.charges.length > 1 &&
                `(${chargesForm.values.charges.length})`}
            </Text>

            {/* Dynamic Charges Rows */}
            <Box mb="md">
              <Grid
                mb="xs"
                style={{
                  fontWeight: 600,
                  color: "#105476",
                }}
                gutter="sm"
              >
                <Grid.Col span={1.75}>
                  Charge Name{" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                <Grid.Col span={1.25}>
                  PP/CC{" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                <Grid.Col span={1.25}>Unit</Grid.Col>
                <Grid.Col span={1}>No of Unit</Grid.Col>
                <Grid.Col span={1.5}>
                  Currency{" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                <Grid.Col span={1}>
                  ROE{" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                <Grid.Col span={1.5}>Amount Per Unit</Grid.Col>
                <Grid.Col span={1.5}>
                  Amount{" "}
                  <Text span c="red">
                    *
                  </Text>
                </Grid.Col>
                {/* <Grid.Col span={1}>Actions</Grid.Col> */}
              </Grid>

              {chargesForm.values.charges.map((charge, index) => (
                <Grid key={index} gutter="sm" mb="xs">
                  <Grid.Col span={1.75}>
                    <TextInput
                      placeholder="Charge Name"
                      value={charge.charge_name}
                      onChange={(e) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.charge_name`,
                          e.target.value
                        );
                        // Clear error when field is updated
                        if (chargeErrors[index]?.charge_name) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].charge_name;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.charge_name}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.25}>
                    <Dropdown
                      placeholder="Select PP/CC"
                      searchable
                      data={[
                        { value: "PP", label: "Prepaid" },
                        { value: "CC", label: "Collect" },
                      ]}
                      value={charge.pp_cc || null}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.pp_cc`,
                          value || ""
                        );
                        // Clear error when field is updated
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
                  <Grid.Col span={1.25}>
                    <Dropdown
                      placeholder="Select Unit"
                      searchable
                      data={unitOptions}
                      value={charge.unit_code || null}
                      onChange={(value) => {
                        const unitUpper = (value || "").toUpperCase();
                        // Auto-set no_of_unit to 1 for specific units
                        let noOfUnit = charge.no_of_unit;
                        if (
                          unitUpper === "SHIPMENT" ||
                          unitUpper === "SHPT" ||
                          unitUpper === "DOC"
                        ) {
                          noOfUnit = 1;
                        }
                        chargesForm.setFieldValue(
                          `charges.${index}.unit_code`,
                          value || ""
                        );
                        if (noOfUnit !== charge.no_of_unit) {
                          chargesForm.setFieldValue(
                            `charges.${index}.no_of_unit`,
                            noOfUnit
                          );
                        }
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <NumberInput
                      placeholder="No of Unit"
                      min={0}
                      hideControls
                      {...(() => {
                        const inputProps = chargesForm.getInputProps(
                          `charges.${index}.no_of_unit`
                        );
                        return {
                          value: inputProps.value as number | undefined,
                          onChange: (value: number | string | null) => {
                            chargesForm.setFieldValue(
                              `charges.${index}.no_of_unit`,
                              value as number | null
                            );
                            // Auto-calculate amount if amount_per_unit is provided
                            const currentCharge =
                              chargesForm.values.charges[index];
                            if (
                              currentCharge.amount_per_unit !== null &&
                              currentCharge.amount_per_unit !== undefined &&
                              currentCharge.amount_per_unit > 0
                            ) {
                              const roe =
                                currentCharge.roe !== null &&
                                currentCharge.roe !== undefined
                                  ? currentCharge.roe
                                  : 0;
                              const noOfUnit =
                                value !== null && value !== undefined
                                  ? typeof value === "number"
                                    ? value
                                    : Number(value)
                                  : 0;
                              const amountPerUnit =
                                currentCharge.amount_per_unit;
                              const calculatedAmount =
                                roe * noOfUnit * amountPerUnit;
                              if (calculatedAmount > 0) {
                                chargesForm.setFieldValue(
                                  `charges.${index}.amount`,
                                  calculatedAmount
                                );
                              }
                            }
                          },
                        };
                      })()}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.5}>
                    <Dropdown
                      placeholder="Select Currency"
                      searchable
                      data={currencyOptions}
                      value={charge.currency || null}
                      onChange={(value) => {
                        const roe = value ? getRoeValue(value) : null;
                        chargesForm.setFieldValue(
                          `charges.${index}.currency`,
                          value || ""
                        );
                        if (roe !== null) {
                          chargesForm.setFieldValue(
                            `charges.${index}.roe`,
                            roe
                          );
                        }
                        // Clear error when field is updated
                        if (chargeErrors[index]?.currency) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].currency;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.currency}
                    />
                  </Grid.Col>
                  <Grid.Col span={1}>
                    <NumberInput
                      placeholder="ROE"
                      min={0}
                      hideControls
                      value={charge.roe || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.roe`,
                          value as number | null
                        );
                        // Auto-calculate amount if amount_per_unit is provided
                        const currentCharge = chargesForm.values.charges[index];
                        if (
                          currentCharge.amount_per_unit !== null &&
                          currentCharge.amount_per_unit !== undefined &&
                          currentCharge.amount_per_unit > 0
                        ) {
                          const roe =
                            value !== null && value !== undefined
                              ? typeof value === "number"
                                ? value
                                : Number(value)
                              : 0;
                          const noOfUnit =
                            currentCharge.no_of_unit !== null &&
                            currentCharge.no_of_unit !== undefined
                              ? currentCharge.no_of_unit
                              : 0;
                          const amountPerUnit = currentCharge.amount_per_unit;
                          const calculatedAmount =
                            roe * noOfUnit * amountPerUnit;
                          if (calculatedAmount > 0) {
                            chargesForm.setFieldValue(
                              `charges.${index}.amount`,
                              calculatedAmount
                            );
                          }
                        }
                        // Clear error when field is updated
                        if (chargeErrors[index]?.roe) {
                          const newErrors = { ...chargeErrors };
                          if (newErrors[index]) {
                            delete newErrors[index].roe;
                            if (Object.keys(newErrors[index]).length === 0) {
                              delete newErrors[index];
                            }
                          }
                          setChargeErrors(newErrors);
                        }
                      }}
                      error={chargeErrors[index]?.roe}
                    />
                  </Grid.Col>
                  <Grid.Col span={1.5}>
                    <NumberInput
                      placeholder="Amount Per Unit"
                      min={0}
                      hideControls
                      value={charge.amount_per_unit || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.amount_per_unit`,
                          value as number | null
                        );
                        // Auto-calculate amount if amount_per_unit is provided
                        const currentCharge = chargesForm.values.charges[index];
                        if (
                          value !== null &&
                          value !== undefined &&
                          (typeof value === "number" ? value : Number(value)) >
                            0
                        ) {
                          const roe =
                            currentCharge.roe !== null &&
                            currentCharge.roe !== undefined
                              ? currentCharge.roe
                              : 0;
                          const noOfUnit =
                            currentCharge.no_of_unit !== null &&
                            currentCharge.no_of_unit !== undefined
                              ? currentCharge.no_of_unit
                              : 0;
                          const amountPerUnit =
                            typeof value === "number" ? value : Number(value);
                          const calculatedAmount =
                            roe * noOfUnit * amountPerUnit;
                          if (calculatedAmount > 0) {
                            chargesForm.setFieldValue(
                              `charges.${index}.amount`,
                              calculatedAmount
                            );
                          }
                        }
                        // Clear error when field is updated
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
                  <Grid.Col span={1.5}>
                    <NumberInput
                      placeholder="Amount"
                      min={0}
                      hideControls
                      value={charge.amount || undefined}
                      onChange={(value) => {
                        chargesForm.setFieldValue(
                          `charges.${index}.amount`,
                          value as number | null
                        );
                        // Clear error when field is updated
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
                  <Grid.Col
                    span={1}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      justifyContent: "flex-start",
                    }}
                  >
                    {chargesForm.values.charges.length - 1 === index && (
                      <Button
                        size="xs"
                        variant="light"
                        color="#105476"
                        onClick={() => {
                          chargesForm.insertListItem("charges", {
                            charge_name: "",
                            pp_cc: "CC", // Default to "CC" (Collect)
                            unit_code: "",
                            no_of_unit: null,
                            currency: "",
                            roe: null,
                            amount_per_unit: null,
                            amount: null,
                          });
                        }}
                      >
                        <IconPlus size={16} />
                      </Button>
                    )}
                    {chargesForm.values.charges.length > 1 && (
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => {
                          chargesForm.removeListItem("charges", index);
                        }}
                      >
                        <IconTrash size={16} />
                      </Button>
                    )}
                  </Grid.Col>
                </Grid>
              ))}
            </Box>
          </Box>
        </Stepper.Step>

        <Stepper.Completed>
          <Text size="lg" ta="center" c="dimmed" py="xl">
            HBL details saved successfully!
          </Text>
        </Stepper.Completed>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Button
          variant="outline"
          color="#105476"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => {
            // Determine navigation path based on edit mode
            const isInEditMode = location.state?.job && location.state.job.id;
            const navigatePath = isInEditMode
              ? "/SeaExport/import-job/edit"
              : "/SeaExport/import-job/create";

            navigate(navigatePath, {
              state: {
                fromHouseCreate: true,
                housingDetails: existingHousingDetails,
                ...(location.state?.job && { job: location.state.job }),
                // Only send these back in CREATE MODE
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
              },
            });
          }}
        >
          Back to Import Job
        </Button>

        <Group>
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
    </Box>
  );
}

export default HouseCreate;
