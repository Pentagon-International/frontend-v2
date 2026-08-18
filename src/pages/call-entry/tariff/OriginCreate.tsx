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
  Modal,
  Flex,
  Divider,
  LoadingOverlay,
  Center,
  Loader,
  Menu,
  ActionIcon,
} from "@mantine/core";
import {
  carrierDisplayFormat,
  carrierTransportParamsFromService,
  formatCarrierDisplayValue,
  parseCarrierNameFromLabel,
} from "../../../utils/carrierSelect";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import {
  IconCalendar,
  IconPlus,
  IconTrash,
  IconInfoCircle,
  IconSparkles,
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconDotsVertical,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_HEADER } from "../../../store/storeKeys";
import { URL } from "../../../api/serverUrls";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { ToastNotification, SearchableSelect, SingleDateInput } from "../../../components";
import FormNumberInput from "../../../components/FormNumberInput";
import EditPageAuditInfoIcon from "../../../components/EditPageAuditInfoIcon";
import { normalizeEditPageAuditInfo } from "../../../utils/editPageAuditInfo";
import { useQuery } from "@tanstack/react-query";
import { useDisclosure } from "@mantine/hooks";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { getAPICall } from "../../../service/getApiCall";
import RequiredLabel from "../../../components/RequiredLabel";
import useAuthStore from "../../../store/authStore";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountBound,
  formatMoneyAmountForUi,
  getAmountDecimalScale,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";

function moneyFormValueToNumber(
  value: string | number | null | undefined,
): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function moneyNumberInputToFormString(value: string | number): string {
  if (value === "" || value === null || value === undefined) return "";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return "";
  return formatMoneyAmountBound(n);
}

// Type definitions for better type safety
type ServiceData = {
  id: number;
  service_code: string;
  service_name: string;
};

// Validation schemas
const mainFormSchema = yup.object({
  origin_code: yup.string().required("Origin is required"),
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

function OriginCreate() {
  const user = useAuthStore((state) => state.user);
  const isVietnamBranch = useMemo(
    () => isVietnamBranchFromUser(user),
    [user],
  );
  bindMoneyWholeNumberMode(isVietnamBranch);
  const amountDecimalScale = getAmountDecimalScale(isVietnamBranch);
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state || null;
  const isEditMode = editData?.actionType === "edit";
  const isViewMode = editData?.actionType === "view";
  const originAuditInfo = useMemo(
    () =>
      normalizeEditPageAuditInfo(
        isEditMode || isViewMode
          ? (editData as Record<string, unknown>)
          : null,
      ),
    [editData, isEditMode, isViewMode],
  );

  // State for number of containers
  const [numberOfContainers, setNumberOfContainers] = useState(1);

  // State for SearchableSelect display values in edit mode
  const [originDisplayValue, setOriginDisplayValue] = useState<string>("");
  const [customerDisplayValues, setCustomerDisplayValues] = useState<string[]>(
    []
  );
  const [carrierDisplayValues, setCarrierDisplayValues] = useState<string[]>(
    []
  );
  const [currencyDisplayValues, setCurrencyDisplayValues] = useState<string[]>(
    []
  );

  // Modal state for origin information
  const [modalOpened, { open, close }] = useDisclosure(false);

  // Modal state for create quote
  const [quoteModalOpened, { open: openQuoteModal, close: closeQuoteModal }] =
    useDisclosure(false);

  // Loading state for API call
  const [isLoadingCharges, setIsLoadingCharges] = useState(false);

  // State for destination display value in quote modal
  const [destinationQuoteDisplayValue, setDestinationQuoteDisplayValue] =
    useState<string>("");

  // Quote form using useForm - updated to support multiple containers like enquiry create
  const quoteForm = useForm({
    initialValues: {
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

  console.log("editData in OriginCreate:", editData);
  console.log("isEditMode:", isEditMode);
  console.log("editData.id:", editData?.id);

  const mainForm = useForm({
    initialValues: {
      origin_code: editData?.origin_name || "",
      service: editData?.service || "",
      valid_from: editData?.valid_from || "",
      valid_to: editData?.valid_to || "",
      status: editData?.status || "ACTIVE",
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
          containers: 1, // Add containers field for view mode
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

  // Simplified effect to update form values when editData changes
  useEffect(() => {
    if (editData && (isEditMode || isViewMode)) {
      // Update main form with basic data
      mainForm.setValues({
        origin_code: editData.origin_code || "",
        service: editData.service || "",
        valid_from: editData.valid_from || "",
        valid_to: editData.valid_to || "",
        status: editData.status || "ACTIVE",
      });

      // Set display value for origin SearchableSelect
      setOriginDisplayValue(editData.origin_name || "");

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
          containers: 1, // Default containers for view mode
        }));

        gridForm.setValues({
          tariff_charges: mappedCharges,
        });

        // Set display values for SearchableSelect components
        const customerDisplays = mappedCharges.map(
          (charge: any) => charge.customer_name || charge.customer_code || ""
        );
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
  }, [editData, isEditMode, isViewMode]);

  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const values = {
      ...mainFormVal,
      ...gridFormVal,
    };
    console.log("Final data----", values);

    try {
      let res;
      if (isEditMode) {
        // Update existing origin
        const updateUrl = `${URL.origin}${editData.id}/`;
        console.log("PUT URL:", updateUrl);
        console.log("PUT Values:", values);
        res = await putAPICall(updateUrl, values as any, API_HEADER);
        if (res) {
          ToastNotification({
            type: "success",
            message: "Origin is updated successfully",
          });
          setIsSubmitting(false);
          navigate("/tariff/origin");
        }
      } else {
        // Create new origin
        res = await postAPICall(URL.origin, values as any, API_HEADER);
        if (res) {
          ToastNotification({
            type: "success",
            message: "Origin charge is created",
          });
          setIsSubmitting(false);
          navigate("/tariff/origin");
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      ToastNotification({
        type: "error",
        message: `Error while ${isEditMode ? "updating" : "creating"} origin: ${err?.message}`,
      });
    }
  };

  // Get selected origin name for modal display
  const selectedOriginName = useMemo(() => {
    return originDisplayValue || null;
  }, [originDisplayValue]);

  // Handle quote creation
  const handleQuoteSubmit = async () => {
    // Validate form
    const validation = quoteForm.validate();
    if (validation.hasErrors) {
      return;
    }

    if (!mainForm.values.origin_code) {
      ToastNotification({
        type: "error",
        message: "Origin code is missing",
      });
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
      origin_code: mainForm.values.origin_code,
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
            origin_code: mainForm.values.origin_code,
            origin_name: originDisplayValue,
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
        origin_code: mainForm.values.origin_code,
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
          fromOrigin: true,
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

  return (
    <>
      <Box
        component="form"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          flex: 1,
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

        <Box mx="auto" h={"100%"}>
          <Flex
            gap="md"
            align="flex-start"
            style={{ height: "100%", width: "100%" }}
          >
            {/* Main Content Area */}
            <Box
              style={{
                flex: 1,
                width: "100%",
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
                  borderRadius: "4px",
                  border: "1px solid #dadada",
                  overflow: "auto",
                  position: "relative",
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Grid px={"md"}>
                  {/* Action Menu - Only show in view or edit mode */}
                  <Grid.Col span={12} style={{ position: "sticky", top: 0, zIndex: 50, backgroundColor: "white", padding: "10px 0" }}>
                    <Grid style={{ borderRadius: "4px", padding: "5px 10px", backgroundColor: "#fafafa" }} align={"center"}>
                      <Grid.Col span={isViewMode || isEditMode ? 6 : 12}>
                        <Group gap={6} wrap="nowrap">
                          <Text
                            size="md"
                            fw={600}
                            c="#105476"
                            style={{
                              fontFamily: "Inter",
                              fontStyle: "medium",
                              fontSize: "16px",
                              color: "#105476",
                              textAlign: "Left" as any,
                            }}
                          >
                            {isViewMode
                              ? "Origin Entry Details (View Only)"
                              : isEditMode
                                ? "Edit Origin Entry"
                                : "Create Origin Entry"}
                          </Text>
                          <EditPageAuditInfoIcon
                            visible={isEditMode || isViewMode}
                            auditInfo={originAuditInfo}
                            animateKey={editData?.id}
                            ariaLabel="Origin audit info"
                          />
                        </Group>
                      </Grid.Col>
                      {(isViewMode || isEditMode) && (
                        <Grid.Col span={6}>
                          <Box
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                            }}
                          >
                            <Menu shadow="md" width={220} position="bottom-end">
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="#105476"
                                  size="md"
                                  styles={{
                                    root: {
                                      fontFamily: "Inter",
                                      fontSize: "13px",
                                      border: "2px solid #E9ECEF",
                                      borderRadius: "4px",
                                      backgroundColor: "white",
                                      "&:hover": {
                                        backgroundColor: "#f8f8f8",
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
                                    padding: "4px",
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
                                      padding: "4px 8px",
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
                                  onClick={openQuoteModal}
                                >
                                  Create Quotation
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Box>
                        </Grid.Col>
                      )}
                    </Grid>
                  </Grid.Col>

                  {/* Origin Selection */}
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                    <Grid gutter="xs">
                      <Grid.Col span={mainForm.values.origin_code ? 10.5 : 12} >
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
                          dropdownZIndex={1000}
                          styles={{
                            input: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              height: "36px",
                            },
                            label: {
                              fontSize: "13px",
                              fontFamily: "Inter",
                              marginBottom: "4px",
                            },
                          }}
                        />
                      </Grid.Col>

                      {mainForm.values.origin_code && (
                        <Grid.Col span={1.5} mt={28}>
                          <Button
                            size="sm"
                            px={0}
                            w={"100%"}
                            color="#105476"
                            onClick={() => open()}
                          >
                            <IconInfoCircle size={16} />
                          </Button>
                        </Grid.Col>
                      )}
                    </Grid>
                  </Grid.Col>

                  {/* Service Selection */}
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
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
                          marginBottom: "4px",
                        },
                      }}
                    />
                  </Grid.Col>

                  {/* No of Containers */}
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
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
                          marginBottom: "4px",
                        },
                      }}
                    />
                  </Grid.Col>

                  {/* Valid From Date */}
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                    <SingleDateInput
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
                    />
                  </Grid.Col>

                  {/* Valid To Date */}
                  <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                    <SingleDateInput
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
                    />
                  </Grid.Col>

                  <Grid.Col span={12} mt="md" style={{ position: "sticky", top: 45, zIndex: 100, backgroundColor: "white", padding: "8px 0" }}>
                    <Grid style={{ borderRadius: "4px", padding: "5px 10px", backgroundColor: "#fafafa" }}>
                      <Grid.Col span={12}>
                        <Text
                          size="md"
                          fw={600}
                          c="#105476"
                          style={{
                            fontFamily: "Inter",
                            fontStyle: "medium",
                            fontSize: "16px",
                            color: "#105476",
                            textAlign: "Left" as any,
                          }}
                        >
                          Tariff Charges
                        </Text>
                      </Grid.Col>
                    </Grid>
                  </Grid.Col>

                  {/* Tariff Charges Grid */}
                  <Grid.Col span={12}>
                    <Stack gap={0}>
                      <Grid w="100%" gutter="sm" py="sm" style={{ position: "sticky", zIndex: 100, top: 88, backgroundColor: "white" }}>
                        <Grid.Col span={2}>
                          <RequiredLabel isViewMode={isViewMode} label="Customer Name" required={false} />
                        </Grid.Col>
                        <Grid.Col span={2}>
                          <RequiredLabel isViewMode={isViewMode} label="Charge Name" required />
                        </Grid.Col>
                        <Grid.Col span={2}>
                          <RequiredLabel isViewMode={isViewMode} label="Carrier" required />
                        </Grid.Col>
                        <Grid.Col span={!isViewMode ? 1.6 : 2}>
                          <RequiredLabel isViewMode={isViewMode} label="Currency" required />
                        </Grid.Col>
                        <Grid.Col span={!isViewMode ? 1.6 : 2}>
                          <RequiredLabel isViewMode={isViewMode} label="Unit" required />
                        </Grid.Col>
                        <Grid.Col span={!isViewMode ? 1.6 : 2}>
                          <RequiredLabel isViewMode={isViewMode} label="Rate" required />
                        </Grid.Col>
                        {!isViewMode && (
                          <Grid.Col span={1}>
                            <Text size="xs" fw={600}>
                              Actions
                            </Text>
                          </Grid.Col>
                        )}
                      </Grid>

                      {gridForm.values.tariff_charges.map((_, index) => (
                        <Grid key={index} w="100%" gutter="sm" mt={index !== 0 ? "sm" : 0}>
                          <Grid.Col span={2}>
                            <SearchableSelect
                              apiEndpoint={URL.customer}
                              placeholder="Search by customer code or name"
                              value={
                                gridForm.values.tariff_charges[index]
                                  .customer_code || null
                              }
                              displayValue={
                                customerDisplayValues[index] || null
                              }
                              returnOriginalData={true}
                              dropdownZIndex={1000}
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
                                  paddingBottom: "5px",
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={2}>
                            <TextInput
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
                                  paddingBottom: "5px",
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={2}>
                            <SearchableSelect
                              apiEndpoint={URL.carrier}
                              placeholder="Search by carrier code or name"
                              value={
                                gridForm.values.tariff_charges[index]
                                  .carrier_code || null
                              }
                              displayValue={formatCarrierDisplayValue(
                                carrierDisplayValues[index],
                                gridForm.values.tariff_charges[index].carrier_code,
                              )}
                              returnOriginalData={true}
                              dropdownZIndex={1000}
                              onChange={(value, selectedData, originalData) => {
                                gridForm.setFieldValue(
                                  `tariff_charges.${index}.carrier_code`,
                                  value || ""
                                );
                                // Update the display value for this specific index
                                // Use carrier_name from original data if available, otherwise use label
                                const carrierName =
                                  (originalData as any)?.carrier_name || parseCarrierNameFromLabel(selectedData?.label || "");
                                const newDisplayValues = [
                                  ...carrierDisplayValues,
                                ];
                                newDisplayValues[index] = carrierName;
                                setCarrierDisplayValues(newDisplayValues);
                              }}
                              searchFields={["carrier_code", "carrier_name"]}
                              displayFormat={carrierDisplayFormat}
                              required={!isViewMode}
                              disabled={isViewMode}
                              minSearchLength={3}
                              additionalParams={carrierTransportParamsFromService(
                                mainForm.values.service,
                              )}
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  paddingBottom: "5px",
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={!isViewMode ? 1.6 : 2}>
                            <SearchableSelect
                              apiEndpoint={URL.currencyMaster}
                              placeholder="Search currency code"
                              value={
                                gridForm.values.tariff_charges[index]
                                  .currency_code || null
                              }
                              displayValue={
                                currencyDisplayValues[index] || null
                              }
                              dropdownZIndex={1000}
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
                                  paddingBottom: "5px",
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={!isViewMode ? 1.6 : 2}>
                            <Select
                              searchable
                              withAsterisk={!isViewMode}
                              placeholder="Select Unit"
                              data={[
                                { value: "20ft", label: "20ft Container" },
                                { value: "40ft", label: "40ft Container" },
                                { value: "shipment", label: "shipment" },
                                { value: "W/M", label: "W/m" },
                                { value: "CBM", label: "CBM" },
                              ]}
                              key={
                                gridForm.values.tariff_charges[index].unit ||
                                `unit-${index}-unit`
                              }
                              disabled={isViewMode}
                              {...gridForm.getInputProps(`tariff_charges.${index}.unit`)}
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
                                  paddingBottom: "5px",
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          <Grid.Col span={!isViewMode ? 1.6 : 2}>
                            <FormNumberInput
                              key={`rate-name-${index}`}
                              min={1}
                              hideControls
                              withAsterisk={!isViewMode}
                              disabled={isViewMode}
                              decimalScale={amountDecimalScale}
                              value={moneyFormValueToNumber(
                                gridForm.values.tariff_charges[index]?.rate,
                              )}
                              onChange={(value) => {
                                gridForm.setFieldValue(
                                  `tariff_charges.${index}.rate`,
                                  moneyNumberInputToFormString(value),
                                );
                              }}
                              error={
                                (gridForm.errors as any)?.tariff_charges?.[
                                  index
                                ]?.rate
                              }
                              styles={{
                                input: {
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                  height: "36px",
                                },
                                label: {
                                  paddingBottom: "5px",
                                  fontSize: "13px",
                                  fontFamily: "Inter",
                                },
                              }}
                            />
                          </Grid.Col>
                          {!isViewMode && (
                            <>
                              <Grid.Col span={0.5}>
                                <Button
                                  variant="light"
                                  color="red"
                                  size="sm"
                                  px={12}
                                  onClick={() => {
                                    if (gridForm.values.tariff_charges.length - 1 > 0) {
                                      gridForm.removeListItem(
                                        "tariff_charges",
                                        index
                                      )
                                    }
                                  }
                                  }
                                >
                                  <IconTrash size={16} />
                                </Button>
                              </Grid.Col>
                              {index === gridForm.values.tariff_charges.length - 1 && (
                                <Grid.Col span={0.5}>
                                  <Button
                                    radius={"sm"}
                                    px={12}
                                    size="sm"
                                    variant="light"
                                    color="#105476"
                                    onClick={() =>
                                      gridForm.insertListItem("tariff_charges", {
                                        customer_code: "",
                                        charge_name: "",
                                        carrier_code: "",
                                        unit: "",
                                        currency_code: "",
                                        rate: "",
                                        containers: 1,
                                      })
                                    }
                                  >
                                    <IconPlus size={16} />
                                  </Button>
                                </Grid.Col>
                              )}
                            </>
                          )}
                        </Grid>
                      ))}
                    </Stack>
                  </Grid.Col>

                  {/* Total Rate Display for All Modes */}
                  <Grid.Col span={12} style={{ position: "sticky", bottom: 0, zIndex: 100, backgroundColor: "white", padding: "5px 0 10px" }}>
                    <Grid style={{ borderRadius: "4px", padding: "4px 10px", backgroundColor: "#fafafa" }}>
                      <Grid.Col span={5}>
                        <Text
                          size="md"
                          fw={600}
                          c="#105476"
                          pt={4}
                          style={{
                            fontFamily: "Inter",
                            fontStyle: "medium",
                            fontSize: "16px",
                            color: "#105476",
                            textAlign: "Left" as any,
                          }}
                        >
                          Total Calculations
                        </Text>
                      </Grid.Col>
                      <Grid.Col span={7}>
                        {/* Unit Type Totals */}
                        {Object.keys(unitTotals).length > 0 && (
                          <Stack gap="xs" my="xs">
                            {Object.entries(unitTotals)
                              .filter(([unit]) => unit !== "shipment")
                              .map(([unit, total]) => {
                                return (
                                  <Grid key={unit} columns={7} align="baseline">
                                    <Grid.Col span={!isViewMode ? 2.6 : 3}>
                                      <Group gap={"sm"} >
                                        <Text size="xs" c="dimmed">
                                          Per Container{" : "}
                                        </Text>
                                        <Text size="sm" fw={600} c="dimmed">
                                          {formatMoneyAmountForUi(
                                            total / numberOfContainers,
                                          )}
                                        </Text>
                                      </Group>
                                    </Grid.Col>
                                    <Grid.Col span={!isViewMode ? 1.6 : 2}>
                                      <Text size="md" fw={500}>
                                        Total {unit}
                                      </Text>
                                    </Grid.Col>
                                    <Grid.Col span={!isViewMode ? 1.6 : 2}>
                                      <Text size="md" pl="sm" fw={600} c="#105476">
                                        {formatMoneyAmountForUi(total)}
                                      </Text>
                                    </Grid.Col>
                                  </Grid>
                                );
                              })}
                          </Stack>
                        )}
                      </Grid.Col>
                    </Grid>
                  </Grid.Col>

                </Grid>
              </Box>

              {/* Footer Buttons */}
              <Box
                p={"sm"}
                style={{
                  border: "1px solid #dadada",
                  padding: "10px 24px",
                  backgroundColor: "#ffffff",
                  borderRadius: "4px",
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
                      onClick={() => navigate("/tariff/origin")}
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

        {/* Origin Information Modal */}
        <Modal
          opened={modalOpened}
          onClose={close}
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
                Enter the destination and container type to create a quote based
                on the current origin tariff data.
              </Text>

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
                dropdownZIndex={1000}
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
      </Box>
    </>
  );
}

export default OriginCreate;
