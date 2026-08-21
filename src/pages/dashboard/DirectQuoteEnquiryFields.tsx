import {
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { yupResolver } from "mantine-form-yup-resolver";
import {
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
} from "react";
import { URL } from "../../api/serverUrls";
import {
  CustomerNameSelect,
  Dropdown,
  SearchableSelect,
} from "../../components";
import FormNumberInput from "../../components/FormNumberInput";
import { getAPICall } from "../../service/getApiCall";
import { postAPICall } from "../../service/postApiCall";
import useAuthStore from "../../store/authStore";
import { API_HEADER } from "../../store/storeKeys";
import {
  buildCustomerCreatePayloadFields,
  INITIAL_CUSTOMER_SELECTION,
  isNewCustomerDetailsPending,
  NEW_CUSTOMER_DETAILS_PENDING_ERROR,
  type CustomerSelectionState,
  type CustomerSelectionType,
} from "../../utils/customerSelection";
import {
  isOtherServiceInland,
  resolveEffectiveServiceType,
  usesAirCargoStructure,
  type OtherServiceOption,
} from "../../utils/otherServiceType";
import {
  directQuoteCustomerSchema,
  serviceFormSchema,
} from "./enquiryFormSchemas";

const FIELD_STYLES = {
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
  },
};

const DEFAULT_CARGO = {
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
  un_no: null,
  class: null,
  pkg_group: null,
  stackable: "Yes",
};

const DEFAULT_SERVICE = {
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
  icd: "",
  service_remark: "",
  commodity: "",
  dimension_unit: "Centimeter",
  diemensions: [],
  cargo_details: [{ ...DEFAULT_CARGO }],
};

type SalespersonRow = {
  value: string;
  label: string;
  sales_coordinator: string;
  customer_service: string;
};

function resolveCurrentUserSalespersonOption(
  options: SalespersonRow[],
  user: ReturnType<typeof useAuthStore.getState>["user"],
): SalespersonRow | null {
  if (!user || !options.length) return null;
  const candidates = [
    String(user.email ?? "").trim().toLowerCase(),
    String(user.full_name ?? "").trim().toLowerCase(),
    String(user.username ?? "").trim().toLowerCase(),
  ].filter(Boolean);
  if (!candidates.length) return null;

  for (const option of options) {
    const person = String(option.value ?? option.label ?? "")
      .trim()
      .toLowerCase();
    if (!person) continue;
    if (candidates.some((c) => c === person)) return option;
    if (candidates.some((c) => person.includes(c) || c.includes(person))) {
      return option;
    }
  }
  return null;
}

type SalespersonsResponse = {
  success?: boolean;
  data?: Array<{
    sales_person?: string;
    sales_coordinator?: string;
    customer_service?: string;
  }>;
};

type CargoRow = {
  hazardous_cargo?: string;
  un_no?: string | null;
  class?: string | null;
  pkg_group?: string | null;
  no_of_packages?: number | null;
  gross_weight?: number | null;
  volume_weight?: number | null;
  chargable_weight?: number | null;
  volume?: number | null;
  chargable_volume?: number | null;
  container_type_code?: string | null;
  no_of_containers?: number | null;
};

type DirectServiceRow = {
  service?: string;
  trade?: string;
  service_code?: string;
  service_name?: string;
  origin_code?: string;
  origin_name?: string;
  destination_code?: string;
  destination_name?: string;
  shipment_terms_code?: string;
  pickup?: string | boolean;
  delivery?: string | boolean;
  cargo_details?: CargoRow[];
};

export type DirectQuoteEnquiryFieldsProps = {
  onEnquiryDataSync?: (data: Record<string, unknown>) => void;
  validateEnquiryRef?: MutableRefObject<(() => boolean) | null>;
};

const fetchSalespersons = async (customerCode: string = "") => {
  return postAPICall(
    URL.salespersons,
    { customer_code: customerCode },
    API_HEADER,
  );
};

const fetchTermsofShipment = async () => {
  return getAPICall(`${URL.termsOfShipment}`, API_HEADER);
};

const fetchContainerType = async () => {
  return getAPICall(`${URL.containerType}`, API_HEADER);
};

const fetchOtherServices = async () => {
  return getAPICall(`${URL.serviceMaster}?filter=other_services`, API_HEADER);
};

function transportModeForService(service: string): "SEA" | "AIR" | null {
  const name = service?.toLowerCase();
  if (name === "fcl" || name === "lcl") return "SEA";
  if (name === "air") return "AIR";
  return null;
}

const directQuoteCustomerDisplayFormat = (item: Record<string, unknown>) => ({
  value: String(item.customer_code),
  label: String(item.customer_name),
});

const directQuotePortDisplayFormat = (item: Record<string, unknown>) => ({
  value: String(item.port_code),
  label: `${item.port_name} (${item.port_code})`,
});

const PORT_ADDITIONAL_PARAMS_SEA = { transport_mode: "SEA" };
const PORT_ADDITIONAL_PARAMS_AIR = { transport_mode: "AIR" };

function portAdditionalParamsForService(
  serviceType: string,
): Record<string, string> | undefined {
  const mode = transportModeForService(serviceType);
  if (mode === "SEA") return PORT_ADDITIONAL_PARAMS_SEA;
  if (mode === "AIR") return PORT_ADDITIONAL_PARAMS_AIR;
  return undefined;
}

export default function DirectQuoteEnquiryFields({
  onEnquiryDataSync,
  validateEnquiryRef,
}: DirectQuoteEnquiryFieldsProps) {
  const { user } = useAuthStore();
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(
    null,
  );
  const [customerSelection, setCustomerSelection] =
    useState<CustomerSelectionState>(INITIAL_CUSTOMER_SELECTION);

  const customerForm = useForm({
    initialValues: {
      customer_code: "",
      enquiry_received_date: dayjs().format("YYYY-MM-DD"),
      sales_person: "",
    },
    validate: yupResolver(directQuoteCustomerSchema),
  });

  const serviceForm = useForm({
    initialValues: {
      service_details: [{ ...DEFAULT_SERVICE }],
    },
    validate: yupResolver(serviceFormSchema),
  });

  const { data: termsOfShipment = [] } = useQuery({
    queryKey: ["tosData"],
    queryFn: fetchTermsofShipment,
    staleTime: Infinity,
  });

  const { data: rawContainerData = [] } = useQuery({
    queryKey: ["containerType"],
    queryFn: fetchContainerType,
    staleTime: Infinity,
  });

  const { data: rawSalespersonsData = [], refetch: refetchSalespersons } =
    useQuery({
      queryKey: ["salespersons", ""],
      queryFn: () => fetchSalespersons(""),
      staleTime: Infinity,
    });

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
    return rawOtherServicesData.map(
      (item: {
        service_code?: string;
        service_name?: string;
        transport_mode?: string;
        full_groupage?: string;
      }) => ({
        value: item.service_code ? String(item.service_code) : "",
        label: item.service_name || "",
        transport_mode: item.transport_mode || "",
        full_groupage: item.full_groupage || "",
      }),
    );
  }, [rawOtherServicesData]);

  const getEffectiveServiceType = useCallback(
    (service: string, serviceCode?: string | null) =>
      resolveEffectiveServiceType(service, serviceCode, otherServicesData),
    [otherServicesData],
  );

  const isInlandOtherService = useCallback(
    (serviceCode?: string | null) =>
      isOtherServiceInland(serviceCode, otherServicesData),
    [otherServicesData],
  );

  const shipmentOptions = useMemo(() => {
    if (!Array.isArray(termsOfShipment) || !termsOfShipment.length) return [];
    return termsOfShipment.map((item: { tos_code?: string; tos_name?: string }) => ({
      value: item.tos_code ? String(item.tos_code) : "",
      label: `${item.tos_name} (${item.tos_code})`,
    }));
  }, [termsOfShipment]);

  const containerTypeData = useMemo(() => {
    if (!Array.isArray(rawContainerData) || !rawContainerData.length) return [];
    return rawContainerData.map((item: { container_code?: string; container_name?: string }) => ({
      value: item.container_code ? String(item.container_code) : "",
      label: item.container_name || "",
    }));
  }, [rawContainerData]);

  const salespersonsData = useMemo((): SalespersonRow[] => {
    const response = rawSalespersonsData as SalespersonsResponse;
    if (!response?.data?.length) return [];
    return response.data.map((item) => ({
      value: item.sales_person ? String(item.sales_person) : "",
      label: item.sales_person || "",
      sales_coordinator: item.sales_coordinator || "",
      customer_service: item.customer_service || "",
    }));
  }, [rawSalespersonsData]);

  const handleCustomerSelection = async (customerId: string) => {
    if (!customerId) {
      refetchSalespersons();
      return;
    }
    try {
      const response = (await fetchSalespersons(customerId)) as SalespersonsResponse;
      if (response?.success && response.data?.length === 1) {
        customerForm.setFieldValue(
          "sales_person",
          response.data[0].sales_person || "",
        );
      } else if (response?.data && response.data.length > 1) {
        customerForm.setFieldValue("sales_person", "");
      }
    } catch {
      // keep existing selection
    }
  };

  const handleDirectQuoteCustomerChange = ({
    value,
    customerName,
    selectionType,
    tempCode,
  }: {
    value: string;
    customerName: string;
    selectionType: CustomerSelectionType;
    tempCode: string | null;
    originalData?: Record<string, unknown> | null;
  }) => {
    customerForm.setFieldValue("customer_code", value || "");
    setCustomerSelection({
      selectionType,
      customerName,
      tempCode,
    });

    if (selectionType !== "freeText") {
      customerForm.clearFieldError("customer_code");
    }

    if (value) {
      setCustomerDisplayName(customerName);

      if (selectionType === "master") {
        handleCustomerSelection(value);
      } else {
        const selfSalesperson = resolveCurrentUserSalespersonOption(
          salespersonsData,
          user,
        );
        if (selfSalesperson) {
          customerForm.setFieldValue(
            "sales_person",
            selfSalesperson.value || "",
          );
        }
      }
    } else {
      setCustomerDisplayName(null);
      setCustomerSelection(INITIAL_CUSTOMER_SELECTION);
      customerForm.clearFieldError("customer_code");
      handleCustomerSelection("");
    }
  };

  const calculateChargeableWeight = useCallback(
    (grossWeight: number | null, volumeWeight: number | null) => {
      if (!grossWeight && !volumeWeight) return 0;
      return Math.max(grossWeight || 0, volumeWeight || 0);
    },
    [],
  );

  const calculateChargeableVolume = useCallback(
    (grossWeight: number | null, volume: number | null) => {
      if (!grossWeight && !volume) return 0;
      const grossWeightInCbm = grossWeight ? grossWeight / 1000 : 0;
      return Math.max(grossWeightInCbm, volume || 0);
    },
    [],
  );

  useEffect(() => {
    const rows =
      (serviceForm.values.service_details as unknown as DirectServiceRow[]) || [];
    rows.forEach((s, idx) => {
      const effectiveType = getEffectiveServiceType(
        String(s?.service || ""),
        s?.service_code,
      );
      const cargo = s?.cargo_details?.[0];
      if (!cargo || !effectiveType) return;

      if (usesAirCargoStructure(effectiveType)) {
        const chargeable = calculateChargeableWeight(
          Number(cargo.gross_weight) || null,
          Number(cargo.volume_weight) || null,
        );
        if (cargo.chargable_weight !== chargeable) {
          serviceForm.setFieldValue(
            `service_details.${idx}.cargo_details.0.chargable_weight`,
            chargeable || null,
          );
        }
      } else if (effectiveType === "LCL") {
        const chargeable = calculateChargeableVolume(
          Number(cargo.gross_weight) || null,
          Number(cargo.volume) || null,
        );
        if (cargo.chargable_volume !== chargeable) {
          serviceForm.setFieldValue(
            `service_details.${idx}.cargo_details.0.chargable_volume`,
            chargeable || null,
          );
        }
      }
    });
  }, [
    serviceForm.values.service_details,
    calculateChargeableWeight,
    calculateChargeableVolume,
    getEffectiveServiceType,
    serviceForm,
  ]);

  useEffect(() => {
    if (!validateEnquiryRef) return;
    validateEnquiryRef.current = () => {
      if (isNewCustomerDetailsPending(customerSelection)) {
        customerForm.setFieldError(
          "customer_code",
          NEW_CUSTOMER_DETAILS_PENDING_ERROR,
        );
        return false;
      }

      const customerResult = customerForm.validate();
      const serviceResult = serviceForm.validate();

      let hasCustomErrors = false;
      (
        serviceForm.values.service_details as unknown as DirectServiceRow[]
      ).forEach((serviceDetail, serviceIndex) => {
        if (
          serviceDetail.service === "OTHERS" &&
          isInlandOtherService(serviceDetail.service_code) &&
          !serviceDetail.trade
        ) {
          serviceForm.setFieldError(
            `service_details.${serviceIndex}.trade`,
            "Trade is required",
          );
          hasCustomErrors = true;
        }
      });

      return (
        !customerResult.hasErrors &&
        !serviceResult.hasErrors &&
        !hasCustomErrors
      );
    };
    return () => {
      validateEnquiryRef.current = null;
    };
  }, [
    validateEnquiryRef,
    customerForm,
    serviceForm,
    isInlandOtherService,
    customerSelection,
  ]);

  useEffect(() => {
    if (!onEnquiryDataSync) return;
    onEnquiryDataSync({
      actionType: "createQuote",
      fromQuotationList: true,
      ...buildCustomerCreatePayloadFields({
        selection: customerSelection,
        customerFieldValue: customerForm.values.customer_code,
        fieldKey: "customer_code",
      }),
      customer_name:
        customerDisplayName || customerSelection.customerName || "",
      enquiry_received_date: dayjs().format("YYYY-MM-DD"),
      sales_person: customerForm.values.sales_person,
      services: serviceForm.values.service_details.map(
        (service: Record<string, unknown>, index: number) => {
          const pickup = service.pickup;
          const delivery = service.delivery;
          return {
            ...service,
            id: service.id ?? index + 1,
            origin_code_read: service.origin_code,
            destination_code_read: service.destination_code,
            shipment_terms_code_read: service.shipment_terms_code,
            pickup: pickup === "true" || pickup === true,
            delivery: delivery === "true" || delivery === true,
            hazardous_cargo:
              Array.isArray(service.cargo_details) &&
              service.cargo_details[0] &&
              (service.cargo_details[0] as { hazardous_cargo?: string })
                .hazardous_cargo === "Yes",
          };
        },
      ),
    });
  }, [
    onEnquiryDataSync,
    customerForm.values,
    serviceForm.values,
    customerDisplayName,
    customerSelection,
  ]);

  const resetServiceAfterTypeChange = (idx: number) => {
    serviceForm.setFieldValue(`service_details.${idx}.cargo_details`, [
      { ...DEFAULT_CARGO },
    ]);
    serviceForm.setFieldValue(`service_details.${idx}.origin_code`, "");
    serviceForm.setFieldValue(`service_details.${idx}.origin_name`, "");
    serviceForm.setFieldValue(`service_details.${idx}.destination_code`, "");
    serviceForm.setFieldValue(`service_details.${idx}.destination_name`, "");
    serviceForm.setFieldValue(`service_details.${idx}.shipment_terms_code`, "");
    serviceForm.setFieldValue(
      `service_details.${idx}.dimension_unit`,
      "Centimeter",
    );
    serviceForm.setFieldValue(`service_details.${idx}.diemensions`, []);
  };

  return (
    <Box px="md" py="xs">
      <Grid gutter="sm">
        <Grid.Col span={4}>
          <CustomerNameSelect
            label="Customer Name"
            required
            apiEndpoint={URL.customer}
            placeholder="Type customer name"
            searchFields={["customer_code", "customer_name"]}
            returnOriginalData
            dropdownZIndex={1000}
            displayFormat={directQuoteCustomerDisplayFormat}
            value={customerForm.values.customer_code}
            displayValue={customerDisplayName}
            allowFreeText
            selectionType={customerSelection.selectionType}
            onCustomerChange={handleDirectQuoteCustomerChange}
            error={customerForm.errors.customer_code as string}
            minSearchLength={3}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <Dropdown
            label="Sales Person"
            withAsterisk
            placeholder="Select Salesperson"
            searchable
            data={salespersonsData}
            nothingFoundMessage="No salespersons found"
            styles={FIELD_STYLES}
            {...customerForm.getInputProps("sales_person")}
          />
        </Grid.Col>

        <Grid.Col span={12} mt="xs">
          <Stack gap="sm">
            {(serviceForm.values.service_details as unknown as DirectServiceRow[]).map(
              (s, serviceIndex) => {
              const serviceType = String(s?.service || "");
              const effectiveServiceType = getEffectiveServiceType(
                serviceType,
                s?.service_code,
              );
              const showInlandTrade =
                serviceType === "OTHERS" &&
                isInlandOtherService(s?.service_code);
              const showStandardTrade = serviceType !== "OTHERS";
              const isHazardous =
                s?.cargo_details?.[0]?.hazardous_cargo === "Yes";
              const cargoDetails = Array.isArray(s?.cargo_details)
                ? s.cargo_details
                : [];
              const showCargo =
                Boolean(serviceType) &&
                (serviceType !== "OTHERS" || Boolean(s?.service_code));

              return (
                <Box
                  key={`direct-quote-service-${serviceIndex}`}
                  style={{
                    border: "1px solid #e9ecef",
                    borderRadius: 10,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Text fw={600} size="sm" c="#105476">
                      Service {serviceIndex + 1}
                    </Text>
                    <Group gap="xs">
                      {serviceIndex === 0 && (
                        <Button
                          variant="light"
                          color="#105476"
                          size="compact-sm"
                          onClick={() =>
                            serviceForm.insertListItem("service_details", {
                              ...DEFAULT_SERVICE,
                            })
                          }
                        >
                          <IconPlus size={16} /> Add Service
                        </Button>
                      )}
                      {serviceForm.values.service_details.length > 1 && (
                        <Button
                          variant="subtle"
                          color="red"
                          onClick={() =>
                            serviceForm.removeListItem("service_details", serviceIndex)
                          }
                        >
                          <IconTrash size={16} />
                        </Button>
                      )}
                    </Group>
                  </Group>

                  <Grid gutter="sm">
                    <Grid.Col span={{ base: 12, md: 2 }}>
                      <Dropdown
                        label="Service"
                        withAsterisk
                        placeholder="Select Service"
                        searchable
                        data={["AIR", "FCL", "LCL", "OTHERS"]}
                        styles={FIELD_STYLES}
                        value={serviceType}
                        onChange={(value) => {
                          serviceForm.setFieldValue(
                            `service_details.${serviceIndex}.service`,
                            value || "",
                          );
                          if (value !== "OTHERS") {
                            serviceForm.setFieldValue(
                              `service_details.${serviceIndex}.service_code`,
                              "",
                            );
                            serviceForm.setFieldValue(
                              `service_details.${serviceIndex}.service_name`,
                              "",
                            );
                          } else {
                            serviceForm.setFieldValue(
                              `service_details.${serviceIndex}.trade`,
                              "",
                            );
                          }
                          if (value) resetServiceAfterTypeChange(serviceIndex);
                        }}
                        error={
                          serviceForm.errors[
                            `service_details.${serviceIndex}.service`
                          ] as string
                        }
                      />
                    </Grid.Col>
                    {serviceType === "OTHERS" ? (
                      <Grid.Col span={{ base: 12, md: 2 }}>
                        <Dropdown
                          label="Service Name"
                          withAsterisk
                          placeholder="Select Service Name"
                          searchable
                          data={otherServicesData}
                          styles={FIELD_STYLES}
                          value={s?.service_code || ""}
                          onChange={(value) => {
                            const selectedService = otherServicesData.find(
                              (item) => item.value === value,
                            );
                            serviceForm.setFieldValue(
                              `service_details.${serviceIndex}.service_code`,
                              value || "",
                            );
                            serviceForm.setFieldValue(
                              `service_details.${serviceIndex}.service_name`,
                              selectedService?.label || "",
                            );
                            if (
                              (selectedService?.transport_mode || "") !== "NA"
                            ) {
                              serviceForm.setFieldValue(
                                `service_details.${serviceIndex}.trade`,
                                "",
                              );
                            }
                            resetServiceAfterTypeChange(serviceIndex);
                          }}
                          error={
                            serviceForm.errors[
                              `service_details.${serviceIndex}.service_code`
                            ] as string
                          }
                        />
                      </Grid.Col>
                    ) : null}
                    {(showStandardTrade || showInlandTrade) && (
                      <Grid.Col span={{ base: 12, md: 2 }}>
                        <Dropdown
                          label="Trade"
                          withAsterisk
                          placeholder="Select Trade"
                          data={["Export", "Import"]}
                          styles={FIELD_STYLES}
                          {...serviceForm.getInputProps(
                            `service_details.${serviceIndex}.trade`,
                          )}
                        />
                      </Grid.Col>
                    )}
                    <Grid.Col span={{ base: 12, md: 2 }}>
                      <SearchableSelect
                        label="Origin"
                        required
                        apiEndpoint={URL.portMaster}
                        placeholder="Search origin"
                        searchFields={["port_code", "port_name"]}
                        dropdownZIndex={1000}
                        displayFormat={directQuotePortDisplayFormat}
                        value={s?.origin_code || ""}
                        displayValue={
                          s?.origin_name
                            ? `${s.origin_name} (${s.origin_code})`
                            : s?.origin_code
                        }
                        additionalParams={portAdditionalParamsForService(
                          effectiveServiceType,
                        )}
                        onChange={(value, selectedData) => {
                          serviceForm.setFieldValue(
                            `service_details.${serviceIndex}.origin_code`,
                            value || "",
                          );
                          serviceForm.setFieldValue(
                            `service_details.${serviceIndex}.origin_name`,
                            selectedData?.label?.split(" (")[0] || "",
                          );
                        }}
                        error={
                          serviceForm.errors[
                            `service_details.${serviceIndex}.origin_code`
                          ] as string
                        }
                        minSearchLength={3}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 2 }}>
                      <SearchableSelect
                        label="Destination"
                        required
                        apiEndpoint={URL.portMaster}
                        placeholder="Search destination"
                        searchFields={["port_code", "port_name"]}
                        dropdownZIndex={1000}
                        displayFormat={directQuotePortDisplayFormat}
                        value={s?.destination_code || ""}
                        displayValue={
                          s?.destination_name
                            ? `${s.destination_name} (${s.destination_code})`
                            : s?.destination_code
                        }
                        additionalParams={portAdditionalParamsForService(
                          effectiveServiceType,
                        )}
                        onChange={(value, selectedData) => {
                          serviceForm.setFieldValue(
                            `service_details.${serviceIndex}.destination_code`,
                            value || "",
                          );
                          serviceForm.setFieldValue(
                            `service_details.${serviceIndex}.destination_name`,
                            selectedData?.label?.split(" (")[0] || "",
                          );
                        }}
                        error={
                          serviceForm.errors[
                            `service_details.${serviceIndex}.destination_code`
                          ] as string
                        }
                        minSearchLength={3}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 2 }}>
                      <Dropdown
                        label="Shipment Terms"
                        withAsterisk
                        placeholder="Select Shipment Terms"
                        searchable
                        data={shipmentOptions}
                        styles={FIELD_STYLES}
                        {...serviceForm.getInputProps(
                          `service_details.${serviceIndex}.shipment_terms_code`,
                        )}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 2 }}>
                      <Dropdown
                        label="Hazardous Cargo"
                        withAsterisk
                        placeholder="Select Hazardous"
                        data={["Yes", "No"]}
                        styles={FIELD_STYLES}
                        value={s?.cargo_details?.[0]?.hazardous_cargo || "No"}
                        onChange={(value) => {
                          serviceForm.setFieldValue(
                            `service_details.${serviceIndex}.cargo_details.0.hazardous_cargo`,
                            value || "No",
                          );
                          if (value === "No") {
                            serviceForm.setFieldValue(
                              `service_details.${serviceIndex}.cargo_details.0.un_no`,
                              null,
                            );
                            serviceForm.setFieldValue(
                              `service_details.${serviceIndex}.cargo_details.0.class`,
                              null,
                            );
                            serviceForm.setFieldValue(
                              `service_details.${serviceIndex}.cargo_details.0.pkg_group`,
                              null,
                            );
                          }
                        }}
                        error={
                          serviceForm.errors[
                            `service_details.${serviceIndex}.cargo_details.0.hazardous_cargo`
                          ] as string
                        }
                      />
                    </Grid.Col>
                    {isHazardous && (
                      <>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput
                            label="UN no"
                            withAsterisk
                            styles={FIELD_STYLES}
                            {...serviceForm.getInputProps(
                              `service_details.${serviceIndex}.cargo_details.0.un_no`,
                            )}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput
                            label="Class"
                            withAsterisk
                            styles={FIELD_STYLES}
                            {...serviceForm.getInputProps(
                              `service_details.${serviceIndex}.cargo_details.0.class`,
                            )}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <TextInput
                            label="PKG Group"
                            withAsterisk
                            styles={FIELD_STYLES}
                            {...serviceForm.getInputProps(
                              `service_details.${serviceIndex}.cargo_details.0.pkg_group`,
                            )}
                          />
                        </Grid.Col>
                      </>
                    )}
                  </Grid>

                  {showCargo && (
                    <Box mt="sm">
                      <Text fw={600} c="#105476" mb="xs" size="sm">
                        Cargo Details
                      </Text>

                      {usesAirCargoStructure(effectiveServiceType) && (
                        <Grid gutter="sm">
                          <Grid.Col span={{ base: 12, md: 3 }}>
                            <FormNumberInput
                              hideControls
                              label="No of Packages"
                              withAsterisk
                              min={1}
                              allowDecimal={false}
                              decimalScale={0}
                              styles={FIELD_STYLES}
                              {...serviceForm.getInputProps(
                                `service_details.${serviceIndex}.cargo_details.0.no_of_packages`,
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 3 }}>
                            <FormNumberInput
                              hideControls
                              label="Gross Weight (kg)"
                              withAsterisk
                              min={0.01}
                              decimalScale={3}
                              styles={FIELD_STYLES}
                              {...serviceForm.getInputProps(
                                `service_details.${serviceIndex}.cargo_details.0.gross_weight`,
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 3 }}>
                            <FormNumberInput
                              hideControls
                              label="Volume Weight (kg)"
                              withAsterisk
                              min={0.01}
                              decimalScale={3}
                              styles={FIELD_STYLES}
                              {...serviceForm.getInputProps(
                                `service_details.${serviceIndex}.cargo_details.0.volume_weight`,
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 3 }}>
                            <FormNumberInput
                              hideControls
                              label="Chargeable Weight (kg)"
                              readOnly
                              decimalScale={3}
                              styles={{
                                ...FIELD_STYLES,
                                input: {
                                  ...FIELD_STYLES.input,
                                  cursor: "not-allowed",
                                },
                              }}
                              value={s?.cargo_details?.[0]?.chargable_weight ?? ""}
                            />
                          </Grid.Col>
                        </Grid>
                      )}

                      {effectiveServiceType === "LCL" && (
                        <Grid gutter="sm">
                          <Grid.Col span={{ base: 12, md: 3 }}>
                            <FormNumberInput
                              hideControls
                              label="No of Packages"
                              withAsterisk
                              min={1}
                              allowDecimal={false}
                              decimalScale={0}
                              styles={FIELD_STYLES}
                              {...serviceForm.getInputProps(
                                `service_details.${serviceIndex}.cargo_details.0.no_of_packages`,
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 3 }}>
                            <FormNumberInput
                              hideControls
                              label="Gross Weight (kg)"
                              withAsterisk
                              min={0.01}
                              decimalScale={3}
                              styles={FIELD_STYLES}
                              {...serviceForm.getInputProps(
                                `service_details.${serviceIndex}.cargo_details.0.gross_weight`,
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 3 }}>
                            <FormNumberInput
                              hideControls
                              label="Volume (cbm)"
                              withAsterisk
                              min={0.01}
                              decimalScale={3}
                              styles={FIELD_STYLES}
                              {...serviceForm.getInputProps(
                                `service_details.${serviceIndex}.cargo_details.0.volume`,
                              )}
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, md: 3 }}>
                            <FormNumberInput
                              hideControls
                              label="Chargeable Volume (cbm)"
                              readOnly
                              decimalScale={3}
                              styles={{
                                ...FIELD_STYLES,
                                input: {
                                  ...FIELD_STYLES.input,
                                  cursor: "not-allowed",
                                },
                              }}
                              value={s?.cargo_details?.[0]?.chargable_volume ?? ""}
                            />
                          </Grid.Col>
                        </Grid>
                      )}

                      {effectiveServiceType === "FCL" && (
                        <Stack gap="xs">
                          {cargoDetails.map((_, cargoIndex: number) => (
                            <Grid
                              key={`fcl-${serviceIndex}-${cargoIndex}`}
                              gutter="sm"
                              align="flex-end"
                            >
                              <Grid.Col span={{ base: 12, md: 3 }}>
                                <Dropdown
                                  label="Container Type"
                                  withAsterisk
                                  searchable
                                  placeholder="Select Container Type"
                                  data={containerTypeData}
                                  styles={FIELD_STYLES}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.container_type_code`,
                                  )}
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 3 }}>
                                <FormNumberInput
                                  hideControls
                                  label="No of Containers"
                                  withAsterisk
                                  min={1}
                                  allowDecimal={false}
                                  decimalScale={0}
                                  styles={FIELD_STYLES}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.no_of_containers`,
                                  )}
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 3 }}>
                                <FormNumberInput
                                  hideControls
                                  label="Gross Weight (kg)"
                                  withAsterisk
                                  min={0.01}
                                  decimalScale={3}
                                  styles={FIELD_STYLES}
                                  {...serviceForm.getInputProps(
                                    `service_details.${serviceIndex}.cargo_details.${cargoIndex}.gross_weight`,
                                  )}
                                />
                              </Grid.Col>
                              <Grid.Col span={{ base: 12, md: 3 }}>
                                <Group gap="xs" wrap="nowrap">
                                  {cargoIndex === cargoDetails.length - 1 && (
                                    <Button
                                      variant="light"
                                      color="#105476"
                                      onClick={() =>
                                        serviceForm.insertListItem(
                                          `service_details.${serviceIndex}.cargo_details`,
                                          { ...DEFAULT_CARGO },
                                        )
                                      }
                                    >
                                      <IconPlus size={16} />
                                    </Button>
                                  )}
                                  {cargoDetails.length > 1 && (
                                    <Button
                                      variant="subtle"
                                      color="red"
                                      onClick={() =>
                                        serviceForm.removeListItem(
                                          `service_details.${serviceIndex}.cargo_details`,
                                          cargoIndex,
                                        )
                                      }
                                    >
                                      <IconTrash size={16} />
                                    </Button>
                                  )}
                                </Group>
                              </Grid.Col>
                            </Grid>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}
                </Box>
              );
              },
            )}

          </Stack>
        </Grid.Col>
      </Grid>
    </Box>
  );
}
