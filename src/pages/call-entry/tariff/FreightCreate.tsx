import {
  Box,
  Grid,
  Select,
  Button,
  Stack,
  TextInput,
  NumberInput,
  Group,
  Text,
  Paper,
  Modal,
  Flex,
  Divider,
  LoadingOverlay,
  Center,
  Loader,
  Menu,
  ActionIcon,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import {
  IconCalendar,
  IconPlus,
  IconTrash,
  IconInfoCircle,
  IconSparkles,
  IconCheck,
  IconDotsVertical,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ToastNotification, SearchableSelect } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
import { useDisclosure } from "@mantine/hooks";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { getAPICall } from "../../../service/getApiCall";

// Type definitions for better type safety
type ServiceData = {
  id: number;
  service_code: string;
  service_name: string;
};

// Validation schemas
const mainFormSchema = yup.object({
  origin_code: yup.string().required("Origin is required"),
  destination_code: yup.string().required("Destination is required"),
  service: yup.string().required("Service is required"),
  valid_from: yup.string().required("Valid from date is required"),
  valid_to: yup.string().required("Valid to date is required"),
  status: yup.string().required("Status is required"),
});

const gridFormSchema = yup.object({
  tariff_charges: yup.array().of(
    yup.object({
      customer_code: yup.string().required("Customer is required"),
      charge_name: yup.string().required("Charge name is required"),
      carrier_code: yup.string().required("Carrier is required"),
      unit: yup.string().required("Unit is required"),
      currency_code: yup.string().required("Currency is required"),
      rate: yup
        .number()
        .required("Rate is required")
        .positive("Rate must be positive"),
      minimum: yup.number().nullable().min(0, "Minimum must be positive"),
    })
  ),
});

// Static service data - no API call needed
const fetchServiceMaster = async () => {
  return [
    {
      id: 1,
      service_code: "LCL",
      service_name: "LCL",
    },
    {
      id: 2,
      service_code: "FCL",
      service_name: "FCL",
    },
    {
      id: 3,
      service_code: "AIR",
      service_name: "AIR",
    },
  ];
};

// Fetch container type data
const fetchContainerType = async () => {
  const response = await getAPICall(`${URL.containerType}`, API_HEADER);
  return response;
};

function FreightCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state || null;
  const isEditMode = editData?.actionType === "edit";
  const isViewMode = editData?.actionType === "view";

  // State for number of containers
  const [numberOfContainers, setNumberOfContainers] = useState(1);

  // State for unit data
  const [unitData, setUnitData] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [isLoadingUnitData, setIsLoadingUnitData] = useState(false);

  // State for SearchableSelect display values in edit mode
  const [originDisplayValue, setOriginDisplayValue] = useState<string>("");
  const [destinationDisplayValue, setDestinationDisplayValue] =
    useState<string>("");
  const [customerDisplayValues, setCustomerDisplayValues] = useState<string[]>(
    []
  );
  const [carrierDisplayValues, setCarrierDisplayValues] = useState<string[]>(
    []
  );
  const [currencyDisplayValues, setCurrencyDisplayValues] = useState<string[]>(
    []
  );

  // Modal states for origin and destination information
  const [originModalOpened, { open: openOrigin, close: closeOrigin }] =
    useDisclosure(false);
  const [
    destinationModalOpened,
    { open: openDestination, close: closeDestination },
  ] = useDisclosure(false);

  // Modal state for create quote
  const [quoteModalOpened, { open: openQuoteModal, close: closeQuoteModal }] =
    useDisclosure(false);

  // Loading state for API call
  const [isLoadingCharges, setIsLoadingCharges] = useState(false);

  // State for origin and destination display values in quote modal
  const [originQuoteDisplayValue, setOriginQuoteDisplayValue] =
    useState<string>("");
  const [destinationQuoteDisplayValue, setDestinationQuoteDisplayValue] =
    useState<string>("");

  // Quote form using useForm - updated to support multiple containers like enquiry create
  const quoteForm = useForm({
    initialValues: {
      origin_code: "",
      origin_name: "",
      destination_code: "",
      destination_name: "",
      container_details: [
        {
          container_type_code: "",
          no_of_containers: 1,
          gross_weight: null,
        },
      ],
    },
    validate: {
      origin_code: (value) => (!value ? "Origin is required" : null),
      destination_code: (value) => (!value ? "Destination is required" : null),
      container_details: (value) => {
        if (!value || value.length === 0) {
          return "At least one container detail is required";
        }
        for (let i = 0; i < value.length; i++) {
          if (!value[i].container_type_code) {
            return `Container type is required for container ${i + 1}`;
          }
          if (!value[i].no_of_containers || value[i].no_of_containers < 1) {
            return `Number of containers must be at least 1 for container ${i + 1}`;
          }
        }
        return null;
      },
    },
  });

  const mainForm = useForm({
    initialValues: {
      origin_code: "",
      destination_code: "",
      valid_from: "",
      valid_to: "",
      status: "ACTIVE",
      service: "",
    },
    validate: yupResolver(mainFormSchema),
  });

  const gridForm = useForm({
    initialValues: {
      tariff_charges: [
        {
          customer_code: "",
          charge_name: "",
          carrier_code: "",
          unit: "",
          currency_code: "",
          rate: "",
          minimum: null,
        },
      ],
    },
    validate: yupResolver(gridFormSchema),
  });

  // Only fetch service data - other data will be fetched via SearchableSelect
  const { data: rawServiceData = [] } = useQuery({
    queryKey: ["serviceMaster"],
    queryFn: fetchServiceMaster,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Fetch container type data for quote modal
  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: fetchContainerType,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Only transform service data - other data will be handled by SearchableSelect
  const serviceData = useMemo(() => {
    if (!Array.isArray(rawServiceData) || !rawServiceData.length) return [];

    return rawServiceData.map((item: ServiceData) => ({
      value: String(item.service_code),
      label: item.service_name,
    }));
  }, [rawServiceData]);

  const containerTypeData = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];

    return rawContainerData.map((item: any) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: item.container_name,
    }));
  }, [rawContainerData]);

  // Calculate totals by unit type - memoized for performance
  const calculateTotalsByUnitType = useCallback(() => {
    const unitTotals: { [key: string]: number } = {};
    let shipmentTotal = 0;
    let nonShipmentTotal = 0;

    gridForm.values.tariff_charges.forEach((charge) => {
      const rate = parseFloat(String(charge.rate)) || 0;
      const unit = charge.unit || "Unit";

      if (unit === "shipment") {
        // Shipment charges are added once (not multiplied by containers)
        shipmentTotal += rate;
        if (!unitTotals[unit]) {
          unitTotals[unit] = 0;
        }
        unitTotals[unit] += rate;
      } else {
        // Non-shipment charges are multiplied by containers
        nonShipmentTotal += rate;
        if (!unitTotals[unit]) {
          unitTotals[unit] = 0;
        }
        unitTotals[unit] += rate;
      }
    });

    // Calculate final totals for display
    const finalUnitTotals: { [key: string]: number } = {};
    Object.entries(unitTotals).forEach(([unit, total]) => {
      if (unit === "shipment") {
        finalUnitTotals[unit] = total; // Shipment stays as is
      } else {
        // Add shipment total to each non-shipment unit
        finalUnitTotals[unit] = total * numberOfContainers + shipmentTotal;
      }
    });

    // Overall total: non-shipment * containers + shipment
    const overallTotal = nonShipmentTotal * numberOfContainers + shipmentTotal;

    return { unitTotals: finalUnitTotals, overallTotal };
  }, [gridForm.values.tariff_charges, numberOfContainers]);

  // Calculate totals for display - memoized
  const totals = useMemo(
    () => calculateTotalsByUnitType(),
    [calculateTotalsByUnitType]
  );
  const { unitTotals } = totals;

  // Fetch unit data based on service type
  const fetchUnitData = useCallback(async (serviceType: string) => {
    if (!serviceType) {
      setUnitData([]);
      return;
    }

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
        // Use all data from response without filtering
        const formattedData = response.data.map((item: any) => ({
          value: item.unit_code,
          label: item.unit_code,
        }));
        console.log("formattedData unitdata---", formattedData);

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

  // Fetch unit data when service changes
  useEffect(() => {
    if (mainForm.values.service) {
      fetchUnitData(mainForm.values.service);
    } else {
      setUnitData([]);
    }
  }, [mainForm.values.service, fetchUnitData]);

  // Simplified effect to update form values when editData changes
  useEffect(() => {
    if (editData && (isEditMode || isViewMode)) {
      // Update main form with basic data
      mainForm.setValues({
        origin_code: editData.origin_code || "",
        destination_code: editData.destination_code || "",
        service: editData.service || "",
        valid_from: editData.valid_from || "",
        valid_to: editData.valid_to || "",
        status: editData.status || "ACTIVE",
      });

      // Set display values for SearchableSelect - allow clearing by setting to empty string
      setOriginDisplayValue(editData.origin_name || "");
      setDestinationDisplayValue(editData.destination_name || "");

      // Update grid form with tariff charges data
      if (editData.tariff_charges && editData.tariff_charges.length > 0) {
        const mappedCharges = editData.tariff_charges.map((charge: any) => ({
          customer_code: charge.customer_code || "",
          customer_name: charge.customer_name || "",
          charge_name: charge.charge_name || "",
          carrier_code: charge.carrier_code || "",
          carrier_name: charge.carrier_name || "",
          unit: charge.unit || "",
          currency_code: charge.currency_code || "",
          currency_name: charge.currency_name || "",
          rate: charge.rate || "",
          minimum: charge.minimum ? parseFloat(String(charge.minimum)) : null,
        }));

        gridForm.setValues({
          tariff_charges: mappedCharges,
        });

        // Set display values for SearchableSelect components
        // For customer: display customer_name, store customer_code
        const customerDisplays = mappedCharges.map(
          (charge: any) => charge.customer_name || ""
        );
        // For carrier: display carrier_name, store carrier_code
        const carrierDisplays = mappedCharges.map(
          (charge: any) => charge.carrier_name || ""
        );
        const currencyDisplays = mappedCharges.map(
          (charge: any) => charge.currency_name || charge.currency_code || ""
        );

        setCustomerDisplayValues(customerDisplays);
        setCarrierDisplayValues(carrierDisplays);
        setCurrencyDisplayValues(currencyDisplays);
      }
    }
  }, [editData, isEditMode, isViewMode, mainForm, gridForm]);

  const tariffSubmit = async () => {
    setIsSubmitting(true);
    // Validate forms before submission
    const mainFormValidation = mainForm.validate();
    const gridFormValidation = gridForm.validate();

    if (mainFormValidation.hasErrors || gridFormValidation.hasErrors) {
      setIsSubmitting(false);
      ToastNotification({
        type: "error",
        message: "Please fix validation errors before submitting",
      });
      return;
    }

    const mainFormVal = mainForm.values;
    const gridFormVal = gridForm.values;

    // Format payload according to API requirements
    // Only send codes, not names, and format tariff_charges properly
    const tariffCharges = gridFormVal.tariff_charges.map((charge: any) => ({
      customer_code: charge.customer_code || null,
      currency_code: charge.currency_code || "",
      carrier_code: charge.carrier_code || "",
      charge_name: charge.charge_name || "",
      unit: charge.unit || "",
      rate: String(charge.rate || ""),
      minimum: charge.minimum ? String(charge.minimum) : null,
    }));

    const values = {
      origin_code: mainFormVal.origin_code,
      destination_code: mainFormVal.destination_code,
      service: mainFormVal.service,
      valid_from: mainFormVal.valid_from,
      valid_to: mainFormVal.valid_to,
      status: mainFormVal.status,
      tariff_charges: tariffCharges,
    };
    console.log("Final data----", values);

    try {
      let res;
      if (isEditMode) {
        // Update existing freight
        // putAPICall appends ${formValue.id}/ to the URL, so we pass the base URL and include id in values
        const updateUrl = `${URL.freight}`;
        const valuesWithId = {
          ...values,
          id: editData.id,
        };
        console.log("PUT URL:", updateUrl);
        console.log("PUT Values:", valuesWithId);
        res = await putAPICall(updateUrl, valuesWithId as any, API_HEADER);
        if (res) {
          ToastNotification({
            type: "success",
            message: "Freight is updated successfully",
          });
          setIsSubmitting(false);
          navigate("/tariff/freight");
        }
      } else {
        // Create new freight
        res = await postAPICall(URL.freight, values as any, API_HEADER);
        if (res) {
          ToastNotification({
            type: "success",
            message: "Freight Charge is created",
          });
          setIsSubmitting(false);
          navigate("/tariff/freight");
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      ToastNotification({
        type: "error",
        message: `Error while ${isEditMode ? "updating" : "creating"} freight: ${err?.message}`,
      });
    }
  };

  // Get selected origin and destination names for modal display
  const selectedOriginName = useMemo(() => {
    return originDisplayValue || null;
  }, [originDisplayValue]);

  const selectedDestinationName = useMemo(() => {
    return destinationDisplayValue || null;
  }, [destinationDisplayValue]);

  // Handle opening quote modal - pre-fill with existing origin and destination
  const handleOpenQuoteModal = () => {
    // Pre-fill quote form with origin and destination from main form
    quoteForm.setValues({
      origin_code: mainForm.values.origin_code || "",
      origin_name: originDisplayValue || "",
      destination_code: mainForm.values.destination_code || "",
      destination_name: destinationDisplayValue || "",
      container_details: [
        {
          container_type_code: "",
          no_of_containers: 1,
          gross_weight: null,
        },
      ],
    });

    // Set display values
    setOriginQuoteDisplayValue(originDisplayValue || "");
    setDestinationQuoteDisplayValue(destinationDisplayValue || "");

    // Open the modal
    openQuoteModal();
  };

  // Handle quote creation
  const handleQuoteSubmit = async () => {
    // Validate form
    const validation = quoteForm.validate();
    if (validation.hasErrors) {
      return;
    }

    if (!mainForm.values.service) {
      ToastNotification({
        type: "error",
        message: "Service is missing",
      });
      return;
    }

    // Get carrier code from the first tariff charge
    const carrierCode = gridForm.values.tariff_charges[0]?.carrier_code;
    const carrierName = carrierDisplayValues[0] || carrierCode;

    if (!carrierCode) {
      ToastNotification({
        type: "error",
        message: "Carrier code is missing from tariff charges",
      });
      return;
    }

    // Create API payload - updated to support multiple containers
    const apiPayload = {
      origin_code: quoteForm.values.origin_code,
      destination_code: quoteForm.values.destination_code,
      carrier_code: carrierCode,
      service: mainForm.values.service,
      container_details: quoteForm.values.container_details.map(
        (container) => ({
          container_type: container.container_type_code,
          no_of_containers: container.no_of_containers,
          gross_weight: container.gross_weight || 0,
        })
      ),
    };

    console.log("API Payload:", apiPayload);

    setIsLoadingCharges(true);

    try {
      // Call API to get charges
      const response = await postAPICall(
        URL.getChargeswithoutEnquiry,
        apiPayload,
        API_HEADER
      );

      console.log("API Response:", response);

      // Type guard for response
      const apiResponse = response as {
        data?: Array<{
          tariff_charges?: any[];
          data?: any[];
        }>;
      };

      if (
        !apiResponse ||
        !apiResponse.data ||
        !Array.isArray(apiResponse.data)
      ) {
        ToastNotification({
          type: "error",
          message: "No charges data found",
        });
        setIsLoadingCharges(false);
        return;
      }

      // Extract charges from the first data item's tariff_charges
      const chargesData =
        apiResponse.data[0]?.tariff_charges || apiResponse.data[0]?.data || [];

      if (!chargesData || chargesData.length === 0) {
        ToastNotification({
          type: "error",
          message: "No charges found in the response",
        });
        setIsLoadingCharges(false);
        return;
      }

      // Prepare enquiry data for stepper 2
      const enquiryData = {
        // Basic enquiry info
        customer_code: "",
        customer_name: "",
        enquiry_received_date: dayjs().format("YYYY-MM-DD"),
        sales_person: "",
        sales_coordinator: "",
        customer_services: "",

        // Service details for stepper 2
        services: [
          {
            service: mainForm.values.service,
            trade: "Export", // Default value, can be changed by user
            origin_code: quoteForm.values.origin_code,
            origin_name: originQuoteDisplayValue,
            destination_code: quoteForm.values.destination_code,
            destination_name: destinationQuoteDisplayValue,
            pickup: false,
            delivery: false,
            pickup_location: "",
            delivery_location: "",
            shipment_terms_code: "",
            hazardous_cargo: false,

            // FCL details with multiple container types
            fcl_details: quoteForm.values.container_details.map(
              (container) => ({
                container_type: container.container_type_code,
                no_of_containers: container.no_of_containers,
                gross_weight: container.gross_weight,
              })
            ),
          },
        ],
      };

      // Prepare quotation data with charges from API response
      const quotationData = {
        carrier_code: carrierCode,
        carrier: carrierName,
        charges: chargesData,
        origin_code: quoteForm.values.origin_code,
        destination_code: quoteForm.values.destination_code,
        service: mainForm.values.service,
        container_details: quoteForm.values.container_details,
      };

      console.log("Navigating to enquiry-create with data:", {
        enquiryData,
        quotationData,
      });

      setIsLoadingCharges(false);
      closeQuoteModal();

      // Navigate to enquiry-create with state
      navigate("/enquiry-create", {
        state: {
          ...enquiryData,
          quotationData,
          actionType: "createQuote",
          fromFreight: true,
        },
      });

      // Reset form fields
      quoteForm.reset();
    } catch (error: any) {
      console.error("Error fetching charges:", error);
      ToastNotification({
        type: "error",
        message: error?.message || "Error fetching charges. Please try again.",
      });
      setIsLoadingCharges(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <>
      <Box
        component="form"
        style={{
          backgroundColor: "#F8F8F8",
          position: "relative",
          borderRadius: "8px",
          overflow: "hidden",
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!isViewMode) {
            tariffSubmit();
          }
        }}
      >
        {isSubmitting && (
          <Center
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(255, 255, 255, 0.65)",
              zIndex: 15,
            }}
          >
            <Loader color="#105476" size="lg" />
          </Center>
        )}

        <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
          <Flex
            gap="md"
            align="flex-start"
            style={{ height: "calc(100vh - 112px)", width: "100%" }}
          >
            {/* Vertical Stepper Sidebar */}
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
                  {isViewMode
                    ? "Freight Entry Details (View Only)"
                    : isEditMode
                      ? "Edit Freight Entry"
                      : "Create Freight Entry"}
                </Text>
              </Box>
            </Box>

            {/* Main Content Area */}
            <Box
              style={{
                flex: 1,
                width: "100%",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "hidden",
                gap: "8px",
              }}
            >
              <Box
                style={{
                  flex: 1,
                  overflowY: "auto",
                  borderRadius: "8px",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Grid style={{ padding: "24px" }}>
                  {/* Action Menu - Only show in view or edit mode */}
                  {(isViewMode || isEditMode) && (
                    <Grid.Col span={12}>
                      <Box
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginBottom: "16px",
                        }}
                      >
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
                                  <IconSparkles size={16} color="#105476" />
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
                              onClick={handleOpenQuoteModal}
                            >
                              Create Quotation
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Box>
                    </Grid.Col>
                  )}

                  {/* Origin Selection */}
                  <Grid.Col span={4}>
                    <Box maw={400}>
                      <Flex gap="sm" align="flex-end">
                        <div
                          style={{
                            flex: mainForm.values.origin_code ? 0.75 : 1,
                            transition: "flex 0.3s ease",
                          }}
                        >
                          <SearchableSelect
                            apiEndpoint={URL.portMaster}
                            label="Origin"
                            placeholder="Search by port code or name"
                            value={mainForm.values.origin_code || null}
                            displayValue={originDisplayValue || null}
                            onChange={(value, selectedData) => {
                              mainForm.setFieldValue(
                                "origin_code",
                                value || ""
                              );
                              setOriginDisplayValue(selectedData?.label || "");
                            }}
                            searchFields={["port_code", "port_name"]}
                            displayFormat={(item) => ({
                              value: String(item.port_code),
                              label: `${item.port_name} (${item.port_code})`,
                            })}
                            required={!isViewMode}
                            disabled={isViewMode}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                              label: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                              },
                            }}
                          />
                        </div>

                        {mainForm.values.origin_code && (
                          <div style={{ flex: 0.25 }}>
                            <Button
                              size="sm"
                              color="#105476"
                              onClick={() => openOrigin()}
                            >
                              <IconInfoCircle size={16} />
                            </Button>
                          </div>
                        )}
                      </Flex>
                    </Box>
                  </Grid.Col>

                  {/* Destination Selection */}
                  <Grid.Col span={4}>
                    <Box maw={400}>
                      <Flex gap="sm" align="flex-end">
                        <div
                          style={{
                            flex: mainForm.values.destination_code ? 0.75 : 1,
                            transition: "flex 0.3s ease",
                          }}
                        >
                          <SearchableSelect
                            apiEndpoint={URL.portMaster}
                            label="Destination"
                            placeholder="Search by port code or name"
                            value={mainForm.values.destination_code || null}
                            displayValue={destinationDisplayValue || null}
                            onChange={(value, selectedData) => {
                              mainForm.setFieldValue(
                                "destination_code",
                                value || ""
                              );
                              setDestinationDisplayValue(
                                selectedData?.label || ""
                              );
                            }}
                            searchFields={["port_code", "port_name"]}
                            displayFormat={(item) => ({
                              value: String(item.port_code),
                              label: `${item.port_name} (${item.port_code})`,
                            })}
                            required={!isViewMode}
                            disabled={isViewMode}
                            styles={{
                              input: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                                height: "36px",
                              },
                              label: {
                                fontSize: "13px",
                                fontFamily: "Inter",
                              },
                            }}
                          />
                        </div>

                        {mainForm.values.destination_code && (
                          <div style={{ flex: 0.25 }}>
                            <Button
                              size="sm"
                              color="#105476"
                              onClick={() => openDestination()}
                            >
                              <IconInfoCircle size={16} />
                            </Button>
                          </div>
                        )}
                      </Flex>
                    </Box>
                  </Grid.Col>

                  {/* Service Selection */}
                  <Grid.Col span={4}>
                    <Box maw={400}>
                      <Select
                        searchable
                        key={mainForm.key("service")}
                        label="Service"
                        withAsterisk={!isViewMode}
                        placeholder="Select Service"
                        data={serviceData}
                        disabled={isViewMode}
                        {...mainForm.getInputProps("service")}
                        onFocus={(event) => {
                          // Auto-select all text when input is focused
                          const input = event.target as HTMLInputElement;
                          if (input && input.value) {
                            input.select();
                          }
                        }}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                          label: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                          },
                        }}
                      />
                    </Box>
                  </Grid.Col>

                  {/* Valid From Date */}
                  <Grid.Col span={4}>
                    <Box maw={400}>
                      <DateInput
                        label="Valid From"
                        withAsterisk={!isViewMode}
                        key={mainForm.key("valid_from")}
                        placeholder="YYYY-MM-DD"
                        disabled={isViewMode}
                        value={
                          mainForm.values.valid_from
                            ? dayjs(mainForm.values.valid_from).toDate()
                            : null
                        }
                        onChange={(date) => {
                          const formatted = date
                            ? dayjs(date).format("YYYY-MM-DD")
                            : "";
                          mainForm.setFieldValue("valid_from", formatted);
                        }}
                        valueFormat="YYYY-MM-DD"
                        leftSection={<IconCalendar size={18} />}
                        leftSectionPointerEvents="none"
                        radius="md"
                        size="sm"
                        styles={
                          {
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                            label: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                            },
                          } as any
                        }
                      />
                    </Box>
                  </Grid.Col>

                  {/* Valid To Date */}
                  <Grid.Col span={4}>
                    <Box maw={400}>
                      <DateInput
                        label="Valid To"
                        withAsterisk={!isViewMode}
                        key={mainForm.key("valid_to")}
                        placeholder="YYYY-MM-DD"
                        disabled={isViewMode}
                        value={
                          mainForm.values.valid_to
                            ? dayjs(mainForm.values.valid_to).toDate()
                            : null
                        }
                        onChange={(date) => {
                          const formatted = date
                            ? dayjs(date).format("YYYY-MM-DD")
                            : "";
                          mainForm.setFieldValue("valid_to", formatted);
                        }}
                        valueFormat="YYYY-MM-DD"
                        leftSection={<IconCalendar size={18} />}
                        leftSectionPointerEvents="none"
                        radius="md"
                        size="sm"
                        styles={
                          {
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                            label: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                            },
                          } as any
                        }
                      />
                    </Box>
                  </Grid.Col>

                  {/* No of Containers */}
                  <Grid.Col span={4}>
                    <Box maw={400}>
                      <NumberInput
                        label="No of Containers"
                        min={1}
                        value={numberOfContainers}
                        onChange={(value) =>
                          setNumberOfContainers(Number(value) || 1)
                        }
                        disabled={isViewMode}
                        styles={{
                          input: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                            height: "36px",
                          },
                          label: {
                            fontSize: "13px",
                            fontFamily: "Inter",
                          },
                        }}
                      />
                    </Box>
                  </Grid.Col>

                  {/* Tariff Charges Grid */}
                  <Grid.Col span={12}>
                    <Stack gap="md">
                      {gridForm.values.tariff_charges.map((_, index) => (
                        <Grid key={index} w="100%" gutter="sm">
                          <Grid.Col span={isViewMode ? 2.5 : 2.5}>
                            <SearchableSelect
                              apiEndpoint={URL.customer}
                              label={index === 0 ? "Customer Name" : ""}
                              placeholder="Search by customer code or name"
                              value={
                                gridForm.values.tariff_charges[index]
                                  .customer_code || null
                              }
                              displayValue={
                                customerDisplayValues[index] || null
                              }
                              returnOriginalData={true}
                              onChange={(value, selectedData, originalData) => {
                                gridForm.setFieldValue(
                                  `tariff_charges.${index}.customer_code`,
                                  value || ""
                                );
                                // Update the display value for this specific index
                                // Use customer_name from original data if available, otherwise use label
                                const customerName =
                                  (originalData as any)?.customer_name ||
                                  selectedData?.label ||
                                  "";
                                const newDisplayValues = [
                                  ...customerDisplayValues,
                                ];
                                newDisplayValues[index] = customerName;
                                setCustomerDisplayValues(newDisplayValues);
                              }}
                              searchFields={["customer_code", "customer_name"]}
                              displayFormat={(item) => ({
                                value: String(item.customer_code),
                                label: String(
                                  item.customer_name || item.customer_code || ""
                                ),
                              })}
                              required={!isViewMode}
                              disabled={isViewMode}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={isViewMode ? 2 : 2}>
                            <TextInput
                              label={index === 0 ? "Charge Name" : ""}
                              withAsterisk={!isViewMode}
                              placeholder="Enter Charge Name"
                              key={`charge-name-${index}`}
                              variant="default"
                              disabled={isViewMode}
                              {...gridForm.getInputProps(
                                `tariff_charges.${index}.charge_name`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={isViewMode ? 2.5 : 1.5}>
                            <SearchableSelect
                              apiEndpoint={URL.carrier}
                              label={index === 0 ? "Carrier" : ""}
                              placeholder="Search by carrier code or name"
                              value={
                                gridForm.values.tariff_charges[index]
                                  .carrier_code || null
                              }
                              displayValue={carrierDisplayValues[index] || null}
                              returnOriginalData={true}
                              onChange={(value, selectedData, originalData) => {
                                gridForm.setFieldValue(
                                  `tariff_charges.${index}.carrier_code`,
                                  value || ""
                                );
                                // Update the display value for this specific index
                                // Use carrier_name from original data if available, otherwise use label
                                const carrierName =
                                  (originalData as any)?.carrier_name ||
                                  selectedData?.label ||
                                  "";
                                const newDisplayValues = [
                                  ...carrierDisplayValues,
                                ];
                                newDisplayValues[index] = carrierName;
                                setCarrierDisplayValues(newDisplayValues);
                              }}
                              searchFields={["carrier_code", "carrier_name"]}
                              displayFormat={(item: any) => ({
                                value: String(item.carrier_code),
                                label: String(
                                  item.carrier_name || item.carrier_code || ""
                                ),
                              })}
                              required={!isViewMode}
                              disabled={isViewMode}
                              minSearchLength={3}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={isViewMode ? 1 : 1}>
                            <Select
                              searchable
                              label={index === 0 ? "Unit" : ""}
                              withAsterisk={!isViewMode}
                              placeholder={
                                isLoadingUnitData
                                  ? "Loading units..."
                                  : unitData.length === 0
                                    ? "Select service first"
                                    : "Select Unit"
                              }
                              data={unitData}
                              key={
                                gridForm.values.tariff_charges[index].unit ||
                                `unit-${index}-unit`
                              }
                              disabled={
                                isViewMode ||
                                isLoadingUnitData ||
                                unitData.length === 0
                              }
                              {...gridForm.getInputProps(
                                `tariff_charges.${index}.unit`
                              )}
                              onFocus={(event) => {
                                // Auto-select all text when input is focused
                                const input = event.target as HTMLInputElement;
                                if (input && input.value) {
                                  input.select();
                                }
                              }}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={isViewMode ? 1 : 1}>
                            <SearchableSelect
                              apiEndpoint={URL.currencyMaster}
                              label={index === 0 ? "Currency" : ""}
                              placeholder="Search by currency code"
                              value={
                                gridForm.values.tariff_charges[index]
                                  .currency_code || null
                              }
                              displayValue={
                                currencyDisplayValues[index] || null
                              }
                              onChange={(value, selectedData) => {
                                gridForm.setFieldValue(
                                  `tariff_charges.${index}.currency_code`,
                                  value || ""
                                );
                                // Update the display value for this specific index
                                const newDisplayValues = [
                                  ...currencyDisplayValues,
                                ];
                                if (selectedData) {
                                  newDisplayValues[index] =
                                    selectedData.label || "";
                                } else {
                                  newDisplayValues[index] = "";
                                }
                                setCurrencyDisplayValues(newDisplayValues);
                              }}
                              searchFields={["code", "name"]}
                              displayFormat={(item: any) => ({
                                value: String(item.code),
                                label: String(item.code),
                              })}
                              required={!isViewMode}
                              disabled={isViewMode}
                              minSearchLength={2}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={isViewMode ? 1.25 : 1.25}>
                            <NumberInput
                              key={`rate-name-${index}`}
                              min={1}
                              label={index === 0 ? "Rate" : ""}
                              withAsterisk={!isViewMode}
                              disabled={isViewMode}
                              {...gridForm.getInputProps(
                                `tariff_charges.${index}.rate`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={isViewMode ? 1.25 : 1.25}>
                            <TextInput
                              key={`minimum-name-${index}`}
                              type="number"
                              label={index === 0 ? "Minimum" : ""}
                              placeholder="Enter value"
                              disabled={isViewMode}
                              {...gridForm.getInputProps(
                                `tariff_charges.${index}.minimum`
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          {!isViewMode && (
                            <>
                              <Grid.Col span={0.75}>
                                <Button
                                  radius={"sm"}
                                  mt={index === 0 ? 25 : 0}
                                  variant="light"
                                  color="#105476"
                                  size="sm"
                                  onClick={() =>
                                    gridForm.insertListItem("tariff_charges", {
                                      customer_code: "",
                                      charge_name: "",
                                      carrier_code: "",
                                      unit: "",
                                      currency_code: "",
                                      rate: "",
                                      minimum: null,
                                    })
                                  }
                                >
                                  <IconPlus size={16} />
                                </Button>
                              </Grid.Col>
                              <Grid.Col span={0.5}>
                                <Button
                                  mt={index === 0 ? 25 : 0}
                                  variant="light"
                                  color="red"
                                  size="sm"
                                  onClick={() =>
                                    gridForm.removeListItem(
                                      "tariff_charges",
                                      index
                                    )
                                  }
                                >
                                  <IconTrash size={16} />
                                </Button>
                              </Grid.Col>
                            </>
                          )}
                        </Grid>
                      ))}
                    </Stack>
                  </Grid.Col>

                  {/* Total Rate Display for All Modes */}
                  <Grid.Col span={12}>
                    <Paper
                      mt="lg"
                      maw={600}
                      style={{ marginLeft: "auto", marginRight: 0 }}
                    >
                      <Text size="lg" fw={600} c="#105476" mb="md">
                        Total Calculations
                      </Text>

                      {/* Unit Type Totals */}
                      {Object.keys(unitTotals).length > 0 && (
                        <Stack gap="xs" mb="md">
                          {Object.entries(unitTotals)
                            .filter(([unit]) => unit !== "shipment") // Hide shipment from display
                            .map(([unit, total]) => {
                              return (
                                <div key={unit}>
                                  <Group justify="space-between">
                                    <Text size="sm" fw={500}>
                                      Total {unit}:
                                    </Text>
                                    <Text size="sm" fw={600} c="#105476">
                                      {total.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </Text>
                                  </Group>
                                  <Text size="xs" c="dimmed" ml="md">
                                    Per Container :{" "}
                                    {(total / numberOfContainers).toFixed(2)}
                                  </Text>
                                </div>
                              );
                            })}
                        </Stack>
                      )}
                    </Paper>
                  </Grid.Col>
                </Grid>
              </Box>

              {/* Footer Buttons */}
              <Box
                style={{
                  padding: "20px 32px",
                  backgroundColor: "#ffffff",
                  borderRadius: "8px",
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
                      onClick={() => navigate("/tariff/freight")}
                    >
                      {isViewMode ? "Back" : "Cancel"}
                    </Button>
                  </Group>

                  <Group gap="sm">
                    {!isViewMode && (
                      <Button
                        type="submit"
                        size="sm"
                        style={{
                          backgroundColor: "#105476",
                          fontSize: "13px",
                          fontFamily: "Inter",
                          fontStyle: "medium",
                        }}
                        rightSection={<IconCheck size={16} />}
                      >
                        {isEditMode ? "Update" : "Submit"}
                      </Button>
                    )}
                  </Group>
                </Group>
              </Box>
            </Box>
          </Flex>
        </Box>

        {/* Create Quote Modal */}
        <Modal
          opened={quoteModalOpened}
          onClose={closeQuoteModal}
          title="Create Quotation"
          centered
          size="xl"
          closeOnClickOutside={!isLoadingCharges}
          closeOnEscape={!isLoadingCharges}
          withCloseButton={!isLoadingCharges}
        >
          <LoadingOverlay visible={isLoadingCharges} />

          <Divider my="sm" />

          {isLoadingCharges && (
            <Center py="xl">
              <Stack align="center" gap="md">
                <Text size="lg" fw={600} c="#105476">
                  Redirecting to create quotation...
                </Text>
                <Text size="sm" c="dimmed">
                  Please wait while fetching the charges
                </Text>
              </Stack>
            </Center>
          )}

          {!isLoadingCharges && (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Enter the origin, destination and container type to create a
                quote based on the current freight tariff data.
              </Text>

              <SearchableSelect
                label="Origin"
                placeholder="Type origin code or name"
                apiEndpoint={URL.portMaster}
                searchFields={["port_code", "port_name"]}
                displayFormat={(item: any) => ({
                  value: String(item.port_code),
                  label: `${item.port_name} (${item.port_code})`,
                })}
                value={quoteForm.values.origin_code}
                displayValue={
                  originQuoteDisplayValue
                    ? `${originQuoteDisplayValue} (${quoteForm.values.origin_code})`
                    : quoteForm.values.origin_code
                }
                onChange={(value, selectedData) => {
                  quoteForm.setFieldValue("origin_code", value || "");
                  if (selectedData) {
                    setOriginQuoteDisplayValue(
                      selectedData.label.split(" (")[0] || ""
                    );
                    quoteForm.setFieldValue(
                      "origin_name",
                      selectedData.label.split(" (")[0] || ""
                    );
                  }
                }}
                required
                minSearchLength={3}
                error={quoteForm.errors.origin_code as string}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                  },
                }}
              />

              <SearchableSelect
                label="Destination"
                placeholder="Type destination code or name"
                apiEndpoint={URL.portMaster}
                searchFields={["port_code", "port_name"]}
                displayFormat={(item: any) => ({
                  value: String(item.port_code),
                  label: `${item.port_name} (${item.port_code})`,
                })}
                value={quoteForm.values.destination_code}
                displayValue={
                  destinationQuoteDisplayValue
                    ? `${destinationQuoteDisplayValue} (${quoteForm.values.destination_code})`
                    : quoteForm.values.destination_code
                }
                onChange={(value, selectedData) => {
                  quoteForm.setFieldValue("destination_code", value || "");
                  if (selectedData) {
                    setDestinationQuoteDisplayValue(
                      selectedData.label.split(" (")[0] || ""
                    );
                    quoteForm.setFieldValue(
                      "destination_name",
                      selectedData.label.split(" (")[0] || ""
                    );
                  }
                }}
                required
                minSearchLength={3}
                error={quoteForm.errors.destination_code as string}
                styles={{
                  input: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                    height: "36px",
                  },
                  label: {
                    fontSize: "13px",
                    fontFamily: "Inter",
                  },
                }}
              />

              {/* Container Details - Multiple containers like enquiry create */}
              <Stack gap="md">
                <Text size="sm" fw={600} c="#105476">
                  Container Details
                </Text>
                {quoteForm.values.container_details.map((_, containerIndex) => (
                  <Box
                    key={`container-${containerIndex}`}
                    p="sm"
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderRadius: 4,
                      border: "1px solid #dee2e6",
                    }}
                  >
                    <Grid>
                      <Grid.Col span={4}>
                        <Select
                          key={quoteForm.key(
                            `container_details.${containerIndex}.container_type_code`
                          )}
                          label={containerIndex === 0 ? "Container Type" : ""}
                          placeholder="Select Container Type"
                          searchable
                          data={containerTypeData}
                          withAsterisk
                          nothingFoundMessage="No container types found"
                          {...quoteForm.getInputProps(
                            `container_details.${containerIndex}.container_type_code`
                          )}
                          onFocus={(event) => {
                            const input = event.target as HTMLInputElement;
                            if (input && input.value) {
                              input.select();
                            }
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
                              color: "#000000",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <NumberInput
                          key={quoteForm.key(
                            `container_details.${containerIndex}.no_of_containers`
                          )}
                          label={containerIndex === 0 ? "No of Containers" : ""}
                          placeholder="Enter number of containers"
                          min={1}
                          withAsterisk
                          {...quoteForm.getInputProps(
                            `container_details.${containerIndex}.no_of_containers`
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
                              color: "#000000",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <NumberInput
                          key={quoteForm.key(
                            `container_details.${containerIndex}.gross_weight`
                          )}
                          label={
                            containerIndex === 0 ? "Gross Weight (kg)" : ""
                          }
                          placeholder="Enter gross weight"
                          min={0}
                          {...quoteForm.getInputProps(
                            `container_details.${containerIndex}.gross_weight`
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
                              color: "#000000",
                              marginBottom: "4px",
                              fontFamily: "Inter",
                            },
                          }}
                        />
                      </Grid.Col>
                      {/* Add button only on the last container detail */}
                      {containerIndex ===
                        quoteForm.values.container_details.length - 1 && (
                        <Grid.Col span={1}>
                          <Button
                            variant="light"
                            color="#105476"
                            mt={containerIndex === 0 ? 25 : 0}
                            size="sm"
                            onClick={() =>
                              quoteForm.insertListItem("container_details", {
                                container_type_code: "",
                                no_of_containers: 1,
                                gross_weight: null,
                              })
                            }
                          >
                            <IconPlus size={16} />
                          </Button>
                        </Grid.Col>
                      )}
                      {/* Remove button */}
                      <Grid.Col span={1}>
                        {quoteForm.values.container_details.length > 1 ? (
                          <Button
                            variant="light"
                            color="red"
                            mt={containerIndex === 0 ? 25 : 0}
                            size="sm"
                            onClick={() =>
                              quoteForm.removeListItem(
                                "container_details",
                                containerIndex
                              )
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
                {quoteForm.errors.container_details && (
                  <Text size="sm" c="red">
                    {quoteForm.errors.container_details as string}
                  </Text>
                )}
              </Stack>

              <Divider my="sm" />

              <Group justify="flex-end" mt="md">
                <Button
                  variant="outline"
                  onClick={closeQuoteModal}
                  disabled={isLoadingCharges}
                >
                  Cancel
                </Button>
                <Button
                  color="teal"
                  onClick={handleQuoteSubmit}
                  loading={isLoadingCharges}
                  disabled={isLoadingCharges}
                >
                  Create Quotation
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Origin Information Modal */}
        <Modal
          opened={originModalOpened}
          onClose={closeOrigin}
          title="Origin Information"
          centered
        >
          <Divider my="sm" />

          <Stack gap="sm">
            <Text size="md" fw={600} color="blue">
              Origin Name:{" "}
              <Text span fw={500} color="dark">
                {selectedOriginName}
              </Text>
            </Text>

            <Text size="md" fw={600} color="blue">
              Origin Code:{" "}
              <Text span fw={500} color="dark">
                {mainForm.values.origin_code}
              </Text>
            </Text>

            <Text size="sm" c="dimmed" mt="sm">
              This origin is available for freight tariff configuration.
            </Text>
          </Stack>
        </Modal>

        {/* Destination Information Modal */}
        <Modal
          opened={destinationModalOpened}
          onClose={closeDestination}
          title="Destination Information"
          centered
        >
          <Divider my="sm" />

          <Stack gap="sm">
            <Text size="md" fw={600} color="blue">
              Destination Name:{" "}
              <Text span fw={500} color="dark">
                {selectedDestinationName}
              </Text>
            </Text>

            <Text size="md" fw={600} color="blue">
              Destination Code:{" "}
              <Text span fw={500} color="dark">
                {mainForm.values.destination_code}
              </Text>
            </Text>

            <Text size="sm" c="dimmed" mt="sm">
              This destination is available for freight tariff configuration.
            </Text>
          </Stack>
        </Modal>
      </Box>
    </>
  );
}

export default FreightCreate;
