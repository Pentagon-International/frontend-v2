import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { Dropdown, SearchableSelect, SingleDateInput, ToastNotification } from "../../../components";
import { API_HEADER } from "../../../store/storeKeys";
import { URL } from "../../../api/serverUrls";
import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  MultiSelect,
  Stack,
  Tabs,
  Switch,
  Text,
  TextInput,
  Textarea,
  ActionIcon,
  Center,
  Loader,
} from "@mantine/core";
import { useForm, UseFormReturnType } from "@mantine/form";
import { yupResolver } from "mantine-form-yup-resolver";
import * as yup from "yup";
import {
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconCheck,
  IconArrowRight,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { putAPICall } from "../../../service/putApiCall";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { useQuery } from "@tanstack/react-query";
import { toTitleCase } from "../../../utils/textFormatter";

// Type definitions
type CountryData = {
  country_code: string;
  country_name: string;
  status: string;
};

type StateData = {
  id: number;
  state_code: string;
  state_name: string;
  status: string;
  country_code: string;
  country_name: string;
};

type CityData = {
  id: number;
  city_code: string;
  city_name: string;
  status: string;
};

type CustomerTypeData = {
  id: number;
  customer_type_code: string;
  customer_type_name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

// API Response wrapper types
type CountryApiResponse = {
  success: boolean;
  message: string;
  data: CountryData[];
};

type StateApiResponse = {
  success: boolean;
  message: string;
  data: StateData[];
};

type CityApiResponse = {
  success: boolean;
  message: string;
  data: CityData[];
};

type CustomerTypeApiResponse = {
  success: boolean;
  message: string;
  data: CustomerTypeData[];
};

type AddressData = {
  id?: number; // Optional - exists for existing addresses in edit mode
  customer_location: string;
  address_type: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone_no: string;
  mobile_no: string;
  email: string;
  pan_no?: string;
  gst_id?: string;
  tan_no?: string;
  arn_no?: string;
  uin_no?: string;
  gst_registration_status?: string;
  composite_regular?: string;
  sez?: boolean;
  pan_aadhaar_link?: boolean;
  Itr_filed?: "Yes" | "No" | "NA" | "";
  tds_threshold_flag?: boolean;
  latitude?: number;
  longitude?: number;
};

type CustomerFormData = {
  customer_name: string;
  customer_type_code: string[];
  term_code: string;
  own_office: string;
  assigned_to: string;
  network_id: string;
  network_name: string;
  addresses_data: AddressData[];
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

type TdsSectionRow = {
  id: number | null;
  section_id: number | null;
  section_code: string;
  section_name: string;
  exemption_tds: boolean;
  exemption_certificate_no: string;
  tds_percent: string;
  valid_from: Date | null;
  valid_to: Date | null;
  tds_lower_limit: string;
};

type TdsDisplayFormValues = {
  tds_sections: TdsSectionRow[];
};

const emptyTdsSectionRow = (): TdsSectionRow => ({
  id: null,
  section_id: null,
  section_code: "",
  section_name: "",
  exemption_tds: false,
  exemption_certificate_no: "",
  tds_percent: "",
  valid_from: null,
  valid_to: null,
  tds_lower_limit: "",
});

type TdsSectionPayloadRow = {
  id?: number;
  section_id: number;
  exemption_tds: boolean;
  exemption_certificate_no: string | null;
  tds_percentage: string | null;
  valid_from: string | null;
  valid_to: string | null;
  tds_lower_limit: string | null;
};

type CustomerSubmitValues = CustomerFormData & {
  tds_section_data?: TdsSectionPayloadRow[];
};

type TdsSectionMasterItem = {
  id?: number;
  tds_section_code?: string;
  tds_section_name?: string;
  tds_section_rate?: string;
  status?: string;
};

// Separate validation schemas for each form
const customerValidationSchema = yup.object({
  customer_name: yup
    .string()
    .required("Customer name is required")
    .min(3, "Customer name must be at least 3 characters")
    .max(100, "Customer name must not exceed 100 characters"),
  customer_type_code: yup
    .array()
    .of(yup.string().required())
    .min(1, "Customer type is required"),
  term_code: yup.string().required("Credit type is required"),
  own_office: yup
    .string()
    .required("Own office selection is required")
    .oneOf(["true", "false"], "Please select a valid option"),
});

const addressValidationSchema = yup.object({
  addresses_data: yup
    .array()
    .of(
      yup.object({
        // customer_location: yup
        //   .string()
        //   .required("Location is required")
        //   .min(2, "Location must be at least 2 characters")
        //   .max(100, "Location must not exceed 100 characters"),
        address_type: yup
          .string()
          .required("Address type is required")
          .oneOf(
            ["Primary", "Secondary", "Billing", "Shipping"],
            "Please select a valid address type",
          ),
        address: yup
          .string()
          .required("Address is required")
          .min(5, "Address must be at least 5 characters")
          .max(500, "Address must not exceed 500 characters"),
        country: yup
          .string()
          .required("Country is required")
          .min(2, "Country must be at least 2 characters")
          .max(50, "Country must not exceed 50 characters"),
        phone_no: yup
          .string()
          .matches(
            /^$|^[\d\s\-+()]+$/,
            "Phone number can only contain digits, spaces, hyphens, plus signs, and parentheses",
          )
          .max(20, "Phone number must not exceed 20 characters"), // Optional - lanline number
        mobile_no: yup
          .string()
          .required("Mobile number is required")
          .matches(
            /^[\d\s\-+()]+$/,
            "Mobile number can only contain digits, spaces, hyphens, plus signs, and parentheses",
          )
          .min(10, "Mobile number must be at least 10 digits")
          .max(15, "Mobile number must not exceed 15 digits"),
        email: yup
          .string()
          .email("Please enter a valid email address")
          .required("Email is required")
          .max(100, "Email must not exceed 100 characters"),
        pan_no: yup.string().optional().max(20, "PAN must not exceed 20 characters"),
        gst_id: yup.string().optional().max(20, "GST No must not exceed 20 characters"),
        tan_no: yup.string().optional().max(20, "TAN must not exceed 20 characters"),
        arn_no: yup.string().optional().max(30, "ARN must not exceed 30 characters"),
        uin_no: yup.string().optional().max(30, "UIN must not exceed 30 characters"),
        gst_registration_status: yup.string().optional(),
        composite_regular: yup.string().optional().oneOf(["composite", "Regular", ""], "Select Composite or Regular"),
        sez: yup.boolean().optional(),
        latitude: yup
          .number()
          .optional()
          .min(-90, "Latitude must be between -90 and 90")
          .max(90, "Latitude must be between -90 and 90"),
        longitude: yup
          .number()
          .optional()
          .min(-180, "Longitude must be between -180 and 180")
          .max(180, "Longitude must be between -180 and 180"),
      }),
    )
    .min(1, "At least one address is required"),
});

const twoDecimalInputRegex = /^\d*(\.\d{0,2})?$/;
const twoDecimalRequiredRegex = /^\d+(\.\d{1,2})?$/;

function formatDateYYYYMMDD(value: Date | null): string | null {
  if (!value) return null;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateYYYYMMDD(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function normalizeTwoDecimalString(value: string): string {
  const v = value.trim();
  if (!v) return "";
  const n = Number(v);
  if (!isFinite(n)) return v;
  return n.toFixed(2);
}

function normalizeCustomerTypeCodes(source: {
  customer_type_code?: string | string[] | null;
  customer_type?: string | null;
  customer_types?: Array<{
    customer_type_code?: string | null;
    customer_type_name?: string | null;
  }> | null;
}): string[] {
  if (Array.isArray(source.customer_type_code)) {
    return source.customer_type_code
      .map((v) => String(v).trim())
      .filter(Boolean);
  }

  if (source.customer_type_code) {
    return [String(source.customer_type_code).trim()].filter(Boolean);
  }

  if (Array.isArray(source.customer_types) && source.customer_types.length > 0) {
    return source.customer_types
      .map((item) => String(item?.customer_type_code ?? "").trim())
      .filter(Boolean);
  }

  if (source.customer_type) {
    return [String(source.customer_type).trim()].filter(Boolean);
  }

  return [];
}

const tdsDisplayValidationSchema = yup
  .object({
    tds_sections: yup
      .array()
      .of(
        yup.object({
          section_id: yup
            .number()
            .nullable()
            .required("Section name is required"),
          section_code: yup.string().required("Section name is required"),
          section_name: yup.string().required("Section name is required"),
          exemption_tds: yup.boolean().required(),
          exemption_certificate_no: yup
            .string()
            .when("exemption_tds", {
              is: true,
              then: (s) => s.required("Exemption certificate number is required"),
              otherwise: (s) => s.optional(),
            }),
          tds_percent: yup
            .string()
            .when("exemption_tds", {
              is: true,
              then: (s) =>
                s
                  .required("TDS % is required")
                  .matches(
                    twoDecimalRequiredRegex,
                    "Enter a valid number",
                  ),
              otherwise: (s) =>
                s
                  .optional()
                  .test(
                    "two-decimals",
                    "Enter a valid number",
                    (v) => !v || twoDecimalRequiredRegex.test(v),
                  ),
            }),
          valid_from: yup.date().nullable().when("exemption_tds", {
            is: true,
            then: (s) => s.required("Valid from is required"),
            otherwise: (s) => s.optional(),
          }),
          valid_to: yup.date().nullable().when("exemption_tds", {
            is: true,
            then: (s) => s.required("Valid to is required"),
            otherwise: (s) => s.optional(),
          }),
          tds_lower_limit: yup
            .string()
            .when("exemption_tds", {
              is: true,
              then: (s) =>
                s
                  .required("TDS lower limit is required")
                  .matches(
                    twoDecimalRequiredRegex,
                    "Enter a valid number",
                  ),
              otherwise: (s) =>
                s
                  .optional()
                  .test(
                    "two-decimals",
                    "Enter a valid number",
                    (v) => !v || twoDecimalRequiredRegex.test(v),
                  ),
            }),
        }),
      )
      .min(1, "At least one TDS section is required"),
  })
  .required();

// Term code options
const termCodeOptions = [
  { label: "Credit", value: "CREDIT" },
  { label: "Cash", value: "CASH" },
  { label: "Prepaid", value: "PREPAID" },
];

// Memoized AddressCard component for better performance
const AddressCard = memo(
  ({
    index,
    isViewMode,
    isVendorMasterRoute,
    addressForm,
    countryOptions,
    selectedCountries,
    getStateOptions,
    getStateValue,
    cityOptions,
    getCityValue,
    handleCountryChange,
    handleStateChange,
    handleCityChange,
    handleCustomCityChange,
    handleCitySearch,
    handleClearCustomCity,
    customCities,
    citySearchValues,
    onRemove,
    canRemove,
  }: {
    index: number;
    isViewMode: boolean;
    isVendorMasterRoute: boolean;
    addressForm: UseFormReturnType<{ addresses_data: AddressData[] }>;
    countryOptions: { value: string; label: string }[];
    selectedCountries: Record<number, string>;
    getStateOptions: (
      countryCode: string,
    ) => { value: string; label: string }[];
    getStateValue: (index: number) => string;
    cityOptions: { value: string; label: string }[];
    getCityValue: (cityName: string) => string;
    handleCountryChange: (index: number, countryCode: string) => void;
    handleStateChange: (index: number, stateId: string) => void;
    handleCityChange: (index: number, cityId: string) => void;
    handleCustomCityChange: (index: number, cityName: string) => void;
    handleCitySearch: (index: number, searchValue: string) => void;
    handleClearCustomCity: (index: number) => void;
    customCities: Record<number, boolean>;
    citySearchValues: Record<number, string>;
    onRemove: (index: number) => void;
    canRemove: boolean;
  }) => {
    return (
      <Card key={index} shadow="xs" padding="md">
        <Stack gap="sm">
          <Card withBorder radius="md" padding="md">
            <Box
              mb="sm"
              px="sm"
              py={6}
              style={{
                backgroundColor: "#F3F7FA",
                border: "1px solid #D7E3ED",
                borderRadius: 8,
              }}
            >
              <Text size="sm" fw={600} c="#105476">
                Address
              </Text>
            </Box>
            <Grid>
            <Grid.Col span={4}>
            <TextInput
              label="Location"
              placeholder="Enter location"
              disabled={!!isViewMode}
              value={
                addressForm.values.addresses_data[index]?.customer_location ||
                ""
              }
              onChange={(e) => {
                const formattedValue = toTitleCase(e.target.value);
                addressForm.setFieldValue(
                  `addresses_data.${index}.customer_location`,
                  formattedValue,
                );
              }}
              error={
                (
                  addressForm.errors as unknown as {
                    addresses_data?: Array<Partial<Record<string, string>>>;
                  }
                ).addresses_data?.[index]?.customer_location
              }
            />
          </Grid.Col>

          <Grid.Col span={4}>
            <Select
              label="Address Type"
              withAsterisk
              placeholder="Select address type"
              data={[
                { value: "Primary", label: "Primary" },
                { value: "Secondary", label: "Secondary" },
                { value: "Billing", label: "Billing" },
                { value: "Shipping", label: "Shipping" },
              ]}
              disabled={isViewMode}
              {...addressForm.getInputProps(
                `addresses_data.${index}.address_type`,
              )}
              error={addressForm.errors[`addresses_data.${index}.address_type`]}
            />
          </Grid.Col>

          <Grid.Col span={4}>
            <Textarea
              label="Address"
              withAsterisk
              placeholder="Enter complete address"
              minRows={3}
              disabled={isViewMode}
              value={addressForm.values.addresses_data[index]?.address || ""}
              onChange={(e) => {
                const formattedValue = toTitleCase(e.currentTarget.value);
                addressForm.setFieldValue(
                  `addresses_data.${index}.address`,
                  formattedValue,
                );
              }}
              error={addressForm.errors[`addresses_data.${index}.address`]}
            />
          </Grid.Col>

          <Grid.Col span={4}>
            <Select
              label="Country"
              withAsterisk
              placeholder="Select country"
              searchable
              data={countryOptions}
              disabled={isViewMode}
              value={selectedCountries[index] || ""}
              onChange={(value) => value && handleCountryChange(index, value)}
              limit={50}
              maxDropdownHeight={300}
              error={addressForm.errors[`addresses_data.${index}.country`]}
            />
          </Grid.Col>

          <Grid.Col span={4}>
            <Select
              label="State"
              placeholder="Select state"
              searchable
              data={
                selectedCountries[index]
                  ? getStateOptions(selectedCountries[index])
                  : []
              }
              disabled={isViewMode || !selectedCountries[index]}
              value={getStateValue(index)}
              onChange={(value) => value && handleStateChange(index, value)}
              limit={50}
              maxDropdownHeight={300}
            />
          </Grid.Col>

          <Grid.Col span={4}>
            {customCities[index] ? (
              <TextInput
                label="City"
                placeholder="Enter city name"
                disabled={isViewMode}
                value={
                  citySearchValues[index] !== undefined &&
                  citySearchValues[index] !== ""
                    ? citySearchValues[index]
                    : addressForm.values.addresses_data[index]?.city || ""
                }
                onChange={(e) => {
                  const formattedValue = toTitleCase(e.target.value);
                  handleCustomCityChange(index, formattedValue);
                }}
                error={
                  (
                    addressForm.errors as unknown as {
                      addresses_data?: Array<Partial<Record<string, string>>>;
                    }
                  ).addresses_data?.[index]?.city
                }
                rightSection={
                  !isViewMode && (
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => handleClearCustomCity(index)}
                      title="Switch to dropdown"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  )
                }
              />
            ) : (
              <Select
                key={`city-select-${index}-${addressForm.values.addresses_data[index]?.city || ""}`}
                label="City"
                placeholder="Select or search city"
                searchable
                data={cityOptions}
                disabled={isViewMode}
                value={
                  addressForm.values.addresses_data[index]?.city
                    ? getCityValue(
                        addressForm.values.addresses_data[index].city,
                      )
                    : ""
                }
                onChange={(value) => {
                  if (value) {
                    handleCityChange(index, value);
                  }
                }}
                onSearchChange={(searchValue) => {
                  handleCitySearch(index, searchValue);
                }}
                searchValue={citySearchValues[index] || ""}
                limit={100}
                maxDropdownHeight={300}
                nothingFoundMessage="City not found - type to enter custom city"
              />
            )}
          </Grid.Col>

          <Grid.Col span={4}>
            <TextInput
              label="Pin/Zip Code"
              placeholder="Enter pin/zip code"
              disabled={isViewMode}
              {...addressForm.getInputProps(`addresses_data.${index}.pincode`)}
            />
          </Grid.Col>

          <Grid.Col span={4}>
            <TextInput
              label="Landline Number"
              placeholder="Enter Landline number"
              disabled={isViewMode}
              {...addressForm.getInputProps(`addresses_data.${index}.phone_no`)}
            />
          </Grid.Col>

          <Grid.Col span={4}>
            <TextInput
              label="Mobile Number"
              withAsterisk
              placeholder="Enter mobile number"
              disabled={isViewMode}
              {...addressForm.getInputProps(
                `addresses_data.${index}.mobile_no`,
              )}
            />
          </Grid.Col>

          <Grid.Col span={4}>
            <TextInput
              label="Email Id"
              withAsterisk
              placeholder="Enter email address"
              disabled={isViewMode}
              {...addressForm.getInputProps(`addresses_data.${index}.email`)}
            />
            </Grid.Col>
            </Grid>
          </Card>

          <Card withBorder radius="md" padding="md">
            <Box
              mb="sm"
              px="sm"
              py={6}
              style={{
                backgroundColor: "#F3F7FA",
                border: "1px solid #D7E3ED",
                borderRadius: 8,
              }}
            >
              <Text size="sm" fw={600} c="#105476">
                GST
              </Text>
            </Box>
            <Grid>
            <Grid.Col span={4}>
              <TextInput
                label="PAN No"
                placeholder="Enter PAN number"
                disabled={isViewMode}
                {...addressForm.getInputProps(`addresses_data.${index}.pan_no`)}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="GST No"
                placeholder="Enter GST number"
                disabled={isViewMode}
                {...addressForm.getInputProps(`addresses_data.${index}.gst_id`)}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="TAN No"
                placeholder="Enter TAN number"
                disabled={isViewMode}
                {...addressForm.getInputProps(`addresses_data.${index}.tan_no`)}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="ARN No"
                placeholder="Enter ARN number"
                disabled={isViewMode}
                {...addressForm.getInputProps(`addresses_data.${index}.arn_no`)}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="UIN No"
                placeholder="Enter UIN number"
                disabled={isViewMode}
                {...addressForm.getInputProps(`addresses_data.${index}.uin_no`)}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="GST Registration Status"
                placeholder="Select status"
                data={[
                  { value: "Registered", label: "Registered" },
                  { value: "Unregistered", label: "Unregistered" },
                ]}
                disabled={isViewMode}
                {...addressForm.getInputProps(
                  `addresses_data.${index}.gst_registration_status`,
                )}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Composite / Regular"
                placeholder="Select"
                data={[
                  { value: "composite", label: "Composite" },
                  { value: "Regular", label: "Regular" },
                ]}
                disabled={isViewMode}
                {...addressForm.getInputProps(
                  `addresses_data.${index}.composite_regular`,
                )}
              />
            </Grid.Col>

            {isVendorMasterRoute && (
              <Grid.Col span={4}>
                <Select
                  label="Income tax return filed"
                  placeholder="Select"
                  data={[
                    { value: "Yes", label: "Yes" },
                    { value: "No", label: "No" },
                      { value: "NA", label: "NA" },
                  ]}
                  disabled={isViewMode}
                  {...addressForm.getInputProps(`addresses_data.${index}.Itr_filed`)}
                />
              </Grid.Col>
            )}

            <Grid.Col span={4}>
              <Box pt={22}>
                <Switch
                  label="SEZ"
                  description={
                    addressForm.values.addresses_data[index]?.sez ? "Yes" : "No"
                  }
                  disabled={isViewMode}
                  checked={Boolean(addressForm.values.addresses_data[index]?.sez)}
                  onChange={(e) =>
                    addressForm.setFieldValue(
                      `addresses_data.${index}.sez`,
                      e.currentTarget.checked,
                    )
                  }
                />
              </Box>
            </Grid.Col>

            {isVendorMasterRoute && (
              <>
                <Grid.Col span={4}>
                  <Box pt={22}>
                    <Switch
                      label="PAN/Aadhaar linked"
                      description={
                        addressForm.values.addresses_data[index]
                          ?.pan_aadhaar_link
                          ? "Yes"
                          : "No"
                      }
                      disabled={isViewMode}
                      checked={Boolean(
                        addressForm.values.addresses_data[index]
                          ?.pan_aadhaar_link,
                      )}
                      onChange={(e) =>
                        addressForm.setFieldValue(
                          `addresses_data.${index}.pan_aadhaar_link`,
                          e.currentTarget.checked,
                        )
                      }
                    />
                  </Box>
                </Grid.Col>

                <Grid.Col span={4}>
                  <Box pt={22}>
                    <Switch
                      label="TDS less than 50,000"
                      description={
                        addressForm.values.addresses_data[index]
                          ?.tds_threshold_flag
                          ? "Yes"
                          : "No"
                      }
                      disabled={isViewMode}
                      checked={Boolean(
                        addressForm.values.addresses_data[index]
                          ?.tds_threshold_flag,
                      )}
                      onChange={(e) =>
                        addressForm.setFieldValue(
                          `addresses_data.${index}.tds_threshold_flag`,
                          e.currentTarget.checked,
                        )
                      }
                    />
                  </Box>
                </Grid.Col>
              </>
            )}

            <Grid.Col span={12}>
              <Group justify="right" mb="md">
                {canRemove && (
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => onRemove(index)}
                    disabled={isViewMode}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            </Grid.Col>
            </Grid>
          </Card>
        </Stack>
      </Card>
    );
  },
);

AddressCard.displayName = "AddressCard";

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
    new Date().toISOString(),
  );
  const response = await postAPICall(URL.salespersons, payload, API_HEADER);
  console.log("📊 Salespersons response:", response);
  return response;
};

function CustomerCreate() {
  const [active, setActive] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<
    Record<number, string>
  >({});
  const [selectedStates, setSelectedStates] = useState<Record<number, string>>(
    {},
  );
  const [customCities, setCustomCities] = useState<Record<number, boolean>>({});
  const [citySearchValues, setCitySearchValues] = useState<
    Record<number, string>
  >({});
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [addressStateRestored, setAddressStateRestored] = useState(false);
  // For edit flow: keep existing row IDs keyed by `section_id` so we can send them back on update.
  const [tdsIdBySectionId, setTdsIdBySectionId] = useState<
    Record<number, number>
  >({});
  const [tdsType, setTdsType] = useState<"Company" | "Individual" | "Partnership" | "">("");
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const customerData = location.state?.customerData;

  const isVendorMasterRoute = location.pathname.includes("/master/vendor");
  const baseMasterPath = isVendorMasterRoute ? "/master/vendor" : "/master/customer";

  // Determine the mode based on route parameters
  const isEditMode = Boolean(params.id && location.pathname.includes("/edit/"));
  const isViewMode = Boolean(params.id && location.pathname.includes("/view/"));
  const isCreateMode = !params.id;

  const tdsDisplayForm = useForm<TdsDisplayFormValues>({
    initialValues: {
      tds_sections: [emptyTdsSectionRow()],
    },
    validate: isViewMode ? undefined : yupResolver(tdsDisplayValidationSchema),
    validateInputOnChange: false,
    validateInputOnBlur: false,
  });

  // Customer ID from route parameters
  const customerId = params.id;

  // Salespersons data query - initially with empty customer_id
  const { data: rawSalespersonsData = [] } = useQuery({
    queryKey: ["salespersons", ""],
    queryFn: () => {
      console.log(
        "🚀 React Query calling fetchSalespersons with empty customer_code",
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

  // Fetch countries data
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          `${URL.country}`,
          API_HEADER,
        )) as CountryApiResponse;

        // Handle the API response structure
        if (response && response.success && Array.isArray(response.data)) {
          return response.data;
        }

        // Fallback for different response structure
        if (Array.isArray(response)) {
          return response as CountryData[];
        }

        return [];
      } catch (error) {
        console.error("Error fetching countries:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch states data
  const { data: states = [] } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          `${URL.state}`,
          API_HEADER,
        )) as StateApiResponse;

        // Handle the API response structure
        if (response && response.success && Array.isArray(response.data)) {
          return response.data;
        }

        // Fallback for different response structure
        if (Array.isArray(response)) {
          return response as StateData[];
        }

        return [];
      } catch (error) {
        console.error("Error fetching states:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch cities data
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          `${URL.city}`,
          API_HEADER,
        )) as CityApiResponse;

        // Handle the API response structure
        if (response && response.success && Array.isArray(response.data)) {
          return response.data;
        }

        // Fallback for different response structure
        if (Array.isArray(response)) {
          return response as CityData[];
        }

        return [];
      } catch (error) {
        console.error("Error fetching cities:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch customer types data
  const { data: customerTypes = [] } = useQuery({
    queryKey: ["customerTypes"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          `${URL.customerType}`,
          API_HEADER,
        )) as CustomerTypeApiResponse;

        // Handle the API response structure
        if (response && response.success && Array.isArray(response.data)) {
          return response.data.filter((type) => type.status === "ACTIVE");
        }

        // Fallback for different response structure
        if (Array.isArray(response)) {
          return (response as CustomerTypeData[]).filter(
            (type) => type.status === "ACTIVE",
          );
        }

        return [];
      } catch (error) {
        console.error("Error fetching customer types:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Memoized dropdown options for better performance
  const customerTypeOptions = useMemo(() => {
    const opts = customerTypes.map((type) => ({
      value: type.customer_type_code,
      label: type.customer_type_name,
    }));
    if (!isVendorMasterRoute) return opts;
    const allow = new Set(["supplier", "carrier", "transporter"]);
    return opts.filter((o) =>
      allow.has((o.label || "").toLowerCase()),
    );
  }, [customerTypes, isVendorMasterRoute]);

  // Memoize country options
  const countryOptions = useMemo(() => {
    return countries
      .filter((country) => country.status === "ACTIVE")
      .map((country) => ({
        value: country.country_code,
        label: country.country_name,
      }));
  }, [countries]);

  // Fetch TDS section master data for vendor TDS Section step
  const { data: tdsSectionMaster = [] } = useQuery({
    queryKey: ["tdsSectionMaster"],
    queryFn: async () => {
      try {
        const response = await getAPICall(`${URL.tdsSectionMaster}`, API_HEADER);
        return (response as { data?: unknown[] })?.data ?? response ?? [];
      } catch (error) {
        console.error("Error fetching TDS section master:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: isVendorMasterRoute,
  });

  const tdsSectionOptions = useMemo(() => {
    const rows = (tdsSectionMaster ?? []) as TdsSectionMasterItem[];
    return rows
      .filter((r) => (r.status ? String(r.status).toUpperCase() === "ACTIVE" : true))
      .filter((r) => r.tds_section_code && r.tds_section_name)
      .map((r) => ({
        value: String(r.id ?? ""),
        label: String(r.tds_section_name),
        section_code: String(r.tds_section_code),
      }));
  }, [tdsSectionMaster]);

  // Memoize city options (large dataset - 1292kb)
  const cityOptions = useMemo(() => {
    return cities
      .filter((city) => city.status === "active")
      .map((city) => ({
        value: city.id.toString(),
        label: city.city_name,
      }));
  }, [cities]);

  // Customer Master Form - Static form for customer details
  const customerForm = useForm<CustomerFormData>({
    initialValues: {
      customer_name: "",
      customer_type_code: [],
      term_code: "",
      own_office: "",
      assigned_to: "",
      network_id: "",
      network_name: "",
      addresses_data: [
        {
          customer_location: "",
          address_type: "Primary",
          address: "",
          city: "",
          state: "",
          country: "",
          pincode: "",
          phone_no: "",
          mobile_no: "",
          email: "",
          pan_no: "",
          gst_id: "",
          tan_no: "",
          arn_no: "",
          uin_no: "",
          gst_registration_status: "",
          composite_regular: "",
          sez: false,
          pan_aadhaar_link: false,
          Itr_filed: "",
          tds_threshold_flag: false,
          latitude: 0,
          longitude: 0,
        },
      ],
    },
    // Only apply validation in edit mode, not in view mode
    validate: isViewMode ? undefined : yupResolver(customerValidationSchema),
    // Only validate on submit, not on change or blur
    validateInputOnChange: false,
    validateInputOnBlur: false,
  });

  // Address Form - Dynamic form for address details
  const addressForm = useForm<{ addresses_data: AddressData[] }>({
    initialValues: {
      addresses_data: [
        {
          customer_location: "",
          address_type: "Primary",
          address: "",
          city: "",
          state: "",
          country: "",
          pincode: "",
          phone_no: "",
          mobile_no: "",
          email: "",
          pan_no: "",
          gst_id: "",
          tan_no: "",
          arn_no: "",
          uin_no: "",
          gst_registration_status: "",
          composite_regular: "",
          sez: false,
          pan_aadhaar_link: false,
          Itr_filed: "",
          tds_threshold_flag: false,
          latitude: 0,
          longitude: 0,
        },
      ],
    },
    // Only apply validation in edit mode, not in view mode
    validate: isViewMode ? undefined : yupResolver(addressValidationSchema),
    // Only validate on submit, not on change or blur
    validateInputOnChange: false,
    validateInputOnBlur: false,
  });

  // Restore form data when coming back from relationship mapping (both create and edit mode)
  useEffect(() => {
    if (location.state?.customerFormData && !isFormInitialized) {
      const restoredCustomerData = location.state.customerFormData;
      const restoredAddressData = location.state.addressFormData;

      // Use addressFormData if available, otherwise use addresses_data from customerFormData
      let addressDataToRestore =
        restoredAddressData?.addresses_data ||
        restoredCustomerData?.addresses_data ||
        [];

      // Normalize city values if cities are already loaded (for immediate display)
      if (cities.length > 0 && addressDataToRestore.length > 0) {
        addressDataToRestore = addressDataToRestore.map((addr: AddressData) => {
          if (addr.city) {
            const city = cities.find(
              (c) => c.city_name === addr.city || c.city_code === addr.city,
            );
            if (city) {
              // Normalize to city_name for consistency
              return { ...addr, city: city.city_name };
            }
          }
          return addr;
        });
      }

      // Restore customer form
      if (restoredCustomerData) {
        customerForm.setValues({
          customer_name: restoredCustomerData.customer_name || "",
          customer_type_code: normalizeCustomerTypeCodes(
            restoredCustomerData as {
              customer_type_code?: string | string[] | null;
              customer_type?: string | null;
              customer_types?: Array<{
                customer_type_code?: string | null;
                customer_type_name?: string | null;
              }> | null;
            },
          ),
          term_code: restoredCustomerData.term_code || "",
          own_office: restoredCustomerData.own_office || "",
          assigned_to: restoredCustomerData.assigned_to || "",
          network_id: restoredCustomerData.network_id != null ? String(restoredCustomerData.network_id) : "",
          network_name: restoredCustomerData.network_name || "",
          addresses_data: addressDataToRestore,
        });
      }

      // Restore address form
      if (addressDataToRestore.length > 0) {
        addressForm.setValues({
          addresses_data: addressDataToRestore,
        });
      }

      // Set active step to 2 (Address step) since user was on that step
      setActive(1);
      setIsFormInitialized(true);
      setAddressStateRestored(false); // Reset address state restoration flag when new data arrives
    }
  }, [location.state, isFormInitialized, customerForm, addressForm, cities]);

  // Restore cascading dropdown states for addresses after countries, states, and cities are loaded (both create and edit mode)
  useEffect(() => {
    if (
      location.state?.customerFormData &&
      isFormInitialized &&
      !addressStateRestored &&
      countries.length > 0 &&
      states.length > 0 &&
      cities.length > 0
    ) {
      // Read from form values (which are already normalized) instead of location.state
      const addressDataToRestore = addressForm.values.addresses_data || [];

      if (addressDataToRestore.length > 0) {
        const newSelectedCountries: Record<number, string> = {};
        const newSelectedStates: Record<number, string> = {};
        const newCustomCities: Record<number, boolean> = {};
        const newCitySearchValues: Record<number, string> = {};

        addressDataToRestore.forEach((addr: AddressData, idx: number) => {
          // Restore country selection
          if (addr.country) {
            const country = countries.find(
              (c) =>
                c.country_name === addr.country ||
                c.country_code === addr.country,
            );
            if (country) {
              newSelectedCountries[idx] = country.country_code;
            }
          }

          // Restore state selection
          if (addr.state) {
            let state = states.find((s) => s.state_code === addr.state);
            if (!state) {
              state = states.find((s) => s.state_name === addr.state);
            }
            if (!state && !isNaN(Number(addr.state))) {
              state = states.find((s) => s.id === Number(addr.state));
            }

            if (state) {
              newSelectedStates[idx] = state.state_name;
            } else {
              newSelectedStates[idx] = addr.state;
            }
          }

          // Restore city selection - check if city exists in dropdown
          if (addr.city) {
            // Normalize city value - try to find city and use city_name if found
            let cityValue = addr.city;
            const city = cities.find(
              (c) => c.city_name === addr.city || c.city_code === addr.city,
            );

            if (city) {
              // City exists in dropdown - use city_name for consistency
              cityValue = city.city_name;
              newCustomCities[idx] = false; // Use dropdown
              newCitySearchValues[idx] = ""; // Clear search value

              // Update form value to city_name to ensure dropdown displays correctly
              addressForm.setFieldValue(
                `addresses_data.${idx}.city`,
                cityValue,
              );
              customerForm.setFieldValue(
                `addresses_data.${idx}.city`,
                cityValue,
              );
            } else {
              // City doesn't exist - it's a custom city
              newCustomCities[idx] = true; // Use textbox
              newCitySearchValues[idx] = addr.city; // Store custom value
            }
          } else {
            // No city value - default to dropdown mode
            newCustomCities[idx] = false;
            newCitySearchValues[idx] = "";
          }
        });

        // Batch all state updates together
        setSelectedCountries(newSelectedCountries);
        setSelectedStates(newSelectedStates);
        setCustomCities(newCustomCities);
        setCitySearchValues(newCitySearchValues);
        setAddressStateRestored(true);
      }
    }
  }, [
    location.state,
    isFormInitialized,
    addressStateRestored,
    countries,
    states,
    cities,
    addressForm,
    customerForm,
  ]);

  // Function to fetch customer data for edit/view mode
  const fetchCustomerData = useCallback(
    async (id: string) => {
      if (!customerTypes || customerTypes.length === 0) return;
      try {
        setIsLoading(true);
        const response = await getAPICall(`${URL.customer}/${id}`, API_HEADER);
        if (response) {
          const fetchedCustomerData = response as CustomerFormData & {
            id: number;
            name?: string;
            customer_type?: string;
            customer_types?: Array<{
              customer_type_code?: string;
              customer_type_name?: string;
            }>;
            credit_type?: string;
            assigned_to_display?: string;
            tds_type?: string;
            tds_section_data?: Array<{
              id?: number;
              section_id?: number;
              section_code?: string;
              section_name?: string;
              exemption_tds?: boolean;
              exemption_certificate_no?: string;
              tds_percentage?: string;
              valid_from?: string | null;
              valid_to?: string | null;
              tds_lower_limit?: string;
            }>;
          };

          // Process the fetched data
          const addressData = fetchedCustomerData.addresses_data?.map(
            (
              addr: AddressData & {
                location?: string;
                landline?: string;
                phone?: string;
                mobile?: string;
              },
            ) => {
              // Preserve original city value from API
              const originalCityValue = addr.city || "";
              let cityName = originalCityValue;

              // Try to convert city_code to city_name if it exists in dropdown
              if (cityName) {
                const city = cities.find(
                  (c) => c.city_code === cityName || c.city_name === cityName,
                );
                if (city) {
                  // City exists in dropdown - use city_name for consistency
                  cityName = city.city_name;
                }
                // If city not found, keep original value (could be city_code or custom city name)
              }
              return {
                ...(addr.id != null && { id: addr.id }),
                customer_location:
                  addr.customer_location || addr.location || "",
                address_type: addr.address_type || "Primary",
                address: addr.address || "",
                city: cityName, // Store the city value (name if found, original if not)
                state: addr.state || "",
                country: addr.country || "",
                pincode: addr.pincode || "",
                phone_no: addr.phone_no || addr.landline || addr.phone || "",
                mobile_no: addr.mobile_no || addr.mobile || "",
                email: addr.email || "",
                pan_no: addr.pan_no ?? "",
                pan_aadhaar_link: Boolean((addr as AddressData).pan_aadhaar_link),
                Itr_filed: (addr as AddressData).Itr_filed ?? "",
                tds_threshold_flag: Boolean(
                  (addr as AddressData).tds_threshold_flag,
                ),
                gst_id: addr.gst_id ?? "",
                tan_no: addr.tan_no ?? "",
                arn_no: addr.arn_no ?? "",
                uin_no: addr.uin_no ?? "",
                gst_registration_status: addr.gst_registration_status ?? "",
                composite_regular: addr.composite_regular ?? "",
                sez: Boolean(addr.sez),
                latitude: addr.latitude || 0,
                longitude: addr.longitude || 0,
              };
            },
          ) || [
            {
              customer_location: "",
              address_type: "Primary",
              address: "",
              city: "",
              state: "",
              country: "",
              pincode: "",
              phone_no: "",
              mobile_no: "",
              email: "",
              pan_no: "",
              gst_id: "",
              tan_no: "",
              arn_no: "",
              uin_no: "",
              gst_registration_status: "",
              composite_regular: "",
              sez: false,
              latitude: 0,
              longitude: 0,
            },
          ];

          const fetched = fetchedCustomerData as typeof fetchedCustomerData & { network_id?: number | null; network_name?: string | null };
          const formData = {
            customer_name:
              fetchedCustomerData.customer_name ||
              fetchedCustomerData.name ||
              "",
            customer_type_code: normalizeCustomerTypeCodes(fetchedCustomerData),
            term_code:
              fetchedCustomerData.term_code ||
              fetchedCustomerData.credit_type ||
              "",
            own_office: fetchedCustomerData.own_office ? "true" : "false",
            assigned_to: fetchedCustomerData.assigned_to_display || "",
            network_id: fetched.network_id != null ? String(fetched.network_id) : "",
            network_name: fetched.network_name || "",
            addresses_data: addressData,
          };

          // Set customer form data
          customerForm.setValues({
            customer_name: formData.customer_name,
            customer_type_code: formData.customer_type_code,
            term_code: formData.term_code,
            own_office: formData.own_office,
            assigned_to: formData.assigned_to,
            network_id: formData.network_id,
            network_name: formData.network_name,
            addresses_data: formData.addresses_data,
          });

          // Set address form data
          addressForm.setValues({
            addresses_data: formData.addresses_data,
          });

          if (isVendorMasterRoute && typeof fetchedCustomerData.tds_type === "string") {
            setTdsType(
              (fetchedCustomerData.tds_type as
                | "Company"
                | "Individual"
                | "Partnership"
                | "") ?? "",
            );
          }

          // Vendor-only: restore TDS section rows
          if (isVendorMasterRoute && Array.isArray(fetchedCustomerData.tds_section_data)) {
            const rows: TdsSectionRow[] =
              fetchedCustomerData.tds_section_data.length > 0
                ? fetchedCustomerData.tds_section_data.map((r) => ({
                    id: r.id ?? null,
                    section_id: r.section_id ?? null,
                    section_code: r.section_code ?? "",
                    section_name: r.section_name ?? "",
                    exemption_tds: Boolean(r.exemption_tds),
                    exemption_certificate_no: r.exemption_certificate_no ?? "",
                    tds_percent:
                      r.tds_percentage != null ? String(r.tds_percentage) : "",
                    valid_from: parseDateYYYYMMDD(r.valid_from),
                    valid_to: parseDateYYYYMMDD(r.valid_to),
                    tds_lower_limit:
                      r.tds_lower_limit != null ? String(r.tds_lower_limit) : "",
                  }))
                : [emptyTdsSectionRow()];

            const idMap: Record<number, number> = {};
            fetchedCustomerData.tds_section_data.forEach((r) => {
              if (r.section_id != null && r.id != null) {
                idMap[r.section_id] = r.id;
              }
            });
            setTdsIdBySectionId(idMap);
            tdsDisplayForm.setValues({ tds_sections: rows });
          }

          // Initialize selected countries and states for cascading dropdowns
          const newSelectedCountries: Record<number, string> = {};
          const newSelectedStates: Record<number, string> = {};
          const newCustomCities: Record<number, boolean> = {};
          const newCitySearchValues: Record<number, string> = {};

          addressData.forEach((addr, idx) => {
            if (addr.country) {
              const country = countries.find(
                (c) => c.country_name === addr.country,
              );
              if (country) {
                newSelectedCountries[idx] = country.country_code;
              }
            }
            if (addr.state) {
              newSelectedStates[idx] = addr.state;
            }
            // Check if city exists in dropdown
            if (addr.city) {
              // Check if the city value (could be name or code) exists in dropdown
              const city = cities.find(
                (c) => c.city_name === addr.city || c.city_code === addr.city,
              );
              const cityExists = !!city;
              newCustomCities[idx] = !cityExists;
              // If city doesn't exist in dropdown, store the original value from API to display in text input
              // If city exists, clear search value (will use dropdown)
              newCitySearchValues[idx] = cityExists ? "" : addr.city;
            } else {
              // No city value - default to dropdown mode
              newCustomCities[idx] = false;
              newCitySearchValues[idx] = "";
            }
          });

          setSelectedCountries(newSelectedCountries);
          setSelectedStates(newSelectedStates);
          setCustomCities(newCustomCities);
          setCitySearchValues(newCitySearchValues);
        }
      } catch (error) {
        console.error("Error fetching customer data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to fetch customer data",
        });
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countries, customerTypes, cities, isVendorMasterRoute, tdsDisplayForm], // Added countries and cities dependency (forms excluded to prevent infinite loops)
  );

  // Fetch customer data when in edit or view mode (only if not coming back from relationship mapping)
  useEffect(() => {
    if (
      (isEditMode || isViewMode) &&
      customerId &&
      !customerData &&
      !location.state?.customerFormData && // Don't fetch if we have form data from relationship mapping
      countries.length > 0
    ) {
      fetchCustomerData(customerId);
    }
  }, [
    isEditMode,
    isViewMode,
    customerId,
    customerData,
    fetchCustomerData,
    countries,
    location.state,
  ]); // Added location.state dependency

  // Reset form initialization flag when route changes
  useEffect(() => {
    setIsFormInitialized(false);
  }, [params.id, location.pathname]);

  // Populate form with existing data if editing - only run once when customerData changes (skip if data from location.state)
  useEffect(() => {
    if (
      customerData &&
      !isLoading &&
      !isFormInitialized &&
      !location.state?.customerFormData && // Skip if we have form data from relationship mapping
      countries.length > 0
    ) {
      const addressData = customerData.addresses_data?.map(
        (
          addr: AddressData & {
            location?: string;
            landline?: string;
            phone?: string;
            mobile?: string;
          },
        ) => {
          // Preserve original city value from API
          const originalCityValue = addr.city || "";
          let cityName = originalCityValue;

          // Try to convert city_code to city_name if it exists in dropdown
          if (cityName) {
            const city = cities.find(
              (c) => c.city_code === cityName || c.city_name === cityName,
            );
            if (city) {
              // City exists in dropdown - use city_name for consistency
              cityName = city.city_name;
            }
            // If city not found, keep original value (could be city_code or custom city name)
          }
          return {
            id: addr.id, // Include id if it exists (for edit mode)
            customer_location: addr.customer_location || addr.location || "",
            address_type: addr.address_type || "Primary",
            address: addr.address || "",
            city: cityName, // Store the city value (name if found, original if not)
            state: addr.state || "",
            country: addr.country || "",
            pincode: addr.pincode || "",
            phone_no: addr.phone_no || addr.landline || addr.phone || "",
            mobile_no: addr.mobile_no || addr.mobile || "",
            email: addr.email || "",
            pan_no: addr.pan_no ?? "",
            pan_aadhaar_link: Boolean((addr as AddressData).pan_aadhaar_link),
            Itr_filed: (addr as AddressData).Itr_filed ?? "",
            tds_threshold_flag: Boolean(
              (addr as AddressData).tds_threshold_flag,
            ),
            gst_id: addr.gst_id ?? "",
            tan_no: addr.tan_no ?? "",
            arn_no: addr.arn_no ?? "",
            uin_no: addr.uin_no ?? "",
            gst_registration_status: addr.gst_registration_status ?? "",
            composite_regular: addr.composite_regular ?? "",
            sez: Boolean(addr.sez),
            latitude: addr.latitude || 0,
            longitude: addr.longitude || 0,
          };
        },
      ) || [
        {
          customer_location: "",
          address_type: "Primary",
          address: "",
          city: "",
          state: "",
          country: "",
          pincode: "",
          phone_no: "",
          mobile_no: "",
          email: "",
          pan_no: "",
          gst_id: "",
          tan_no: "",
          arn_no: "",
          uin_no: "",
          gst_registration_status: "",
          composite_regular: "",
          sez: false,
          latitude: 0,
          longitude: 0,
        },
      ];

      const customerDataWithNetwork = customerData as typeof customerData & { network_id?: number | null; network_name?: string | null };
      const formData = {
        customer_name: customerData.customer_name || customerData.name || "",
        customer_type_code: normalizeCustomerTypeCodes(
          customerData as {
            customer_type_code?: string | string[] | null;
            customer_type?: string | null;
            customer_types?: Array<{
              customer_type_code?: string | null;
              customer_type_name?: string | null;
            }> | null;
          },
        ),
        term_code: customerData.term_code || customerData.credit_type || "",
        own_office: customerData.own_office ? "true" : "false",
        assigned_to: customerData.assigned_to_display || "",
        network_id: customerDataWithNetwork.network_id != null ? String(customerDataWithNetwork.network_id) : "",
        network_name: customerDataWithNetwork.network_name || "",
        addresses_data: addressData,
      };

      // Set customer form data
      customerForm.setValues({
        customer_name: formData.customer_name,
        customer_type_code: formData.customer_type_code,
        term_code: formData.term_code,
        own_office: formData.own_office,
        assigned_to: formData.assigned_to,
        network_id: formData.network_id,
        network_name: formData.network_name,
        addresses_data: formData.addresses_data,
      });

      // Set address form data
      addressForm.setValues({
        addresses_data: formData.addresses_data,
      });

      // Vendor-only: when coming from list page, restore TDS rows from location.state.
      if (
        isVendorMasterRoute &&
        Array.isArray(
          (customerData as unknown as { tds_section_data?: unknown[] } | undefined)
            ?.tds_section_data,
        )
      ) {
        const incoming = (
          customerData as unknown as { tds_section_data?: Array<{
          id?: number;
          section_id?: number;
          section_code?: string;
          section_name?: string;
          exemption_tds?: boolean;
          exemption_certificate_no?: string;
          tds_percentage?: string;
          valid_from?: string | null;
          valid_to?: string | null;
          tds_lower_limit?: string;
        }> } | undefined
        )?.tds_section_data;

        const incomingRows = incoming ?? [];

        const rows: TdsSectionRow[] =
          incomingRows.length > 0
            ? incomingRows.map((r) => ({
                id: r.id ?? null,
                section_id: r.section_id ?? null,
                section_code: r.section_code ?? "",
                section_name: r.section_name ?? "",
                exemption_tds: Boolean(r.exemption_tds),
                exemption_certificate_no: r.exemption_certificate_no ?? "",
                tds_percent:
                  r.tds_percentage != null ? String(r.tds_percentage) : "",
                valid_from: parseDateYYYYMMDD(r.valid_from),
                valid_to: parseDateYYYYMMDD(r.valid_to),
                tds_lower_limit:
                  r.tds_lower_limit != null ? String(r.tds_lower_limit) : "",
              }))
            : [emptyTdsSectionRow()];

        const idMap: Record<number, number> = {};
        incomingRows.forEach((r) => {
          if (r.section_id != null && r.id != null) {
            idMap[r.section_id] = r.id;
          }
        });
        setTdsIdBySectionId(idMap);
        tdsDisplayForm.setValues({ tds_sections: rows });
      }

      if (
        isVendorMasterRoute &&
        typeof (customerData as unknown as { tds_type?: unknown } | undefined)?.tds_type ===
          "string"
      ) {
        setTdsType(
          ((customerData as unknown as { tds_type?: string } | undefined)?.tds_type as
            | "Company"
            | "Individual"
            | "Partnership"
            | "") ?? "",
        );
      }

      // Initialize selected countries and states for cascading dropdowns
      const newSelectedCountries: Record<number, string> = {};
      const newSelectedStates: Record<number, string> = {};
      const newCustomCities: Record<number, boolean> = {};
      const newCitySearchValues: Record<number, string> = {};

      addressData.forEach((addr: AddressData, idx: number) => {
        if (addr.country) {
          const country = countries.find(
            (c) => c.country_name === addr.country,
          );
          if (country) {
            newSelectedCountries[idx] = country.country_code;
          }
        }
        if (addr.state) {
          newSelectedStates[idx] = addr.state;
        }
        // Check if city exists in dropdown
        if (addr.city) {
          // Check if the city value (could be name or code) exists in dropdown
          const city = cities.find(
            (c) => c.city_name === addr.city || c.city_code === addr.city,
          );
          const cityExists = !!city;
          newCustomCities[idx] = !cityExists;
          // If city doesn't exist, store the original value to display in text input
          // If city exists, clear search value (will use dropdown)
          newCitySearchValues[idx] = cityExists ? "" : addr.city;
        } else {
          // No city value - default to dropdown mode
          newCustomCities[idx] = false;
          newCitySearchValues[idx] = "";
        }
      });

      setSelectedCountries(newSelectedCountries);
      setSelectedStates(newSelectedStates);
      setCustomCities(newCustomCities);
      setCitySearchValues(newCitySearchValues);

      setIsFormInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerData, isLoading, isFormInitialized, countries, cities]); // Added countries and cities dependency (forms excluded to prevent infinite loops)

  // Tabs navigation handled via setActive.

  const addAddress = () => {
    const newAddress = {
      customer_location: "",
      address_type: "Primary",
      address: "",
      city: "",
      state: "",
      country: "",
      pincode: "",
      phone_no: "",
      mobile_no: "",
      email: "",
      pan_no: "",
      gst_id: "",
      tan_no: "",
      arn_no: "",
      uin_no: "",
      gst_registration_status: "",
      composite_regular: "",
      sez: false,
      latitude: 0,
      longitude: 0,
    };

    // Add to both forms to keep them in sync
    customerForm.insertListItem("addresses_data", newAddress);
    addressForm.insertListItem("addresses_data", newAddress);

    // Clear selected countries and states for new address
    const newIndex = addressForm.values.addresses_data.length;
    setSelectedCountries((prev) => ({ ...prev, [newIndex]: "" }));
    setSelectedStates((prev) => ({ ...prev, [newIndex]: "" }));
    setCustomCities((prev) => ({ ...prev, [newIndex]: false }));
    setCitySearchValues((prev) => ({ ...prev, [newIndex]: "" }));
  };

  const removeAddress = (index: number) => {
    if (addressForm.values.addresses_data.length > 1) {
      // Remove from both forms to keep them in sync
      customerForm.removeListItem("addresses_data", index);
      addressForm.removeListItem("addresses_data", index);

      // Clean up selected countries and states for removed address
      const newSelectedCountries = { ...selectedCountries };
      const newSelectedStates = { ...selectedStates };
      const newCustomCities = { ...customCities };
      const newCitySearchValues = { ...citySearchValues };
      delete newSelectedCountries[index];
      delete newSelectedStates[index];
      delete newCustomCities[index];
      delete newCitySearchValues[index];
      setSelectedCountries(newSelectedCountries);
      setSelectedStates(newSelectedStates);
      setCustomCities(newCustomCities);
      setCitySearchValues(newCitySearchValues);
    }
  };

  // Memoize state options by country for better performance
  const getStateOptions = useCallback(
    (countryCode: string) => {
      return states
        .filter(
          (state) =>
            state.status === "active" && state.country_code === countryCode,
        )
        .map((state) => ({
          value: state.id.toString(),
          label: state.state_name,
        }));
    },
    [states],
  );

  // Get state value for a specific address
  const getStateValue = useCallback(
    (index: number) => {
      if (!selectedStates[index]) return "";
      const state = states.find((s) => s.state_name === selectedStates[index]);
      return state ? state.id.toString() : "";
    },
    [selectedStates, states],
  );

  // Get city value for a specific address
  const getCityValue = useCallback(
    (cityValue: string) => {
      if (!cityValue) return "";
      // Try to find by city_name first
      let city = cities.find((c) => c.city_name === cityValue);
      // If not found, try to find by city_code
      if (!city) {
        city = cities.find((c) => c.city_code === cityValue);
      }
      return city ? city.id.toString() : "";
    },
    [cities],
  );

  // Check if city exists in dropdown options
  // (Removed unused city helpers)

  // Handle country selection - wrapped in useCallback for better performance
  const handleCountryChange = useCallback(
    (index: number, countryCode: string) => {
      // Find the country to get the name
      const country = countries.find((c) => c.country_code === countryCode);
      if (!country) return;

      // Set selected country (this will trigger state options to update)
      setSelectedCountries((prev) => ({ ...prev, [index]: countryCode }));

      // Clear state value and display value
      setSelectedStates((prev) => {
        const newStates = { ...prev };
        delete newStates[index]; // Clear state display value
        return newStates;
      });

      // Clear city - if it was textbox mode, reset to dropdown mode
      setCustomCities((prev) => {
        const newCities = { ...prev };
        newCities[index] = false; // Explicitly set to false to reset to dropdown mode
        return newCities;
      });

      // Clear city search values
      setCitySearchValues((prev) => {
        const newSearchValues = { ...prev };
        delete newSearchValues[index];
        return newSearchValues;
      });

      // Update both forms to keep them in sync - store country code for payload
      customerForm.setFieldValue(
        `addresses_data.${index}.country`,
        country.country_code,
      );
      customerForm.setFieldValue(`addresses_data.${index}.state`, "");
      customerForm.setFieldValue(`addresses_data.${index}.city`, "");

      addressForm.setFieldValue(
        `addresses_data.${index}.country`,
        country.country_code,
      );
      addressForm.setFieldValue(`addresses_data.${index}.state`, "");
      addressForm.setFieldValue(`addresses_data.${index}.city`, "");
    },
    [countries, customerForm, addressForm],
  );

  // Handle state selection - wrapped in useCallback for better performance
  const handleStateChange = useCallback(
    (index: number, stateId: string) => {
      // Find the state to get the name
      const state = states.find((s) => s.id.toString() === stateId);
      if (!state) return;

      setSelectedStates((prev) => ({ ...prev, [index]: state.state_name }));

      // Update both forms to keep them in sync - store state name for payload
      customerForm.setFieldValue(
        `addresses_data.${index}.state`,
        state.state_code,
      );

      addressForm.setFieldValue(
        `addresses_data.${index}.state`,
        state.state_code,
      );
    },
    [states, customerForm, addressForm],
  );

  // Handle city selection - wrapped in useCallback for better performance
  const handleCityChange = useCallback(
    (index: number, cityId: string) => {
      // Find the city to get the name
      const city = cities.find((c) => c.id.toString() === cityId);
      if (!city) return;

      // Mark as not custom city
      setCustomCities((prev) => ({ ...prev, [index]: false }));

      // Update both forms to keep them in sync - store city name for payload
      customerForm.setFieldValue(
        `addresses_data.${index}.city`,
        city.city_name,
      );
      addressForm.setFieldValue(`addresses_data.${index}.city`, city.city_name);

      // Clear search value
      setCitySearchValues((prev) => ({ ...prev, [index]: "" }));
    },
    [cities, customerForm, addressForm],
  );

  // Handle custom city input
  const handleCustomCityChange = useCallback(
    (index: number, cityName: string) => {
      // Mark as custom city
      setCustomCities((prev) => ({ ...prev, [index]: true }));

      // Update both forms with custom city name
      customerForm.setFieldValue(`addresses_data.${index}.city`, cityName);
      addressForm.setFieldValue(`addresses_data.${index}.city`, cityName);

      // Update search value
      setCitySearchValues((prev) => ({ ...prev, [index]: cityName }));
    },
    [customerForm, addressForm],
  );

  // Handle city search - check if we should switch to text input
  const handleCitySearch = useCallback(
    (index: number, searchValue: string) => {
      setCitySearchValues((prev) => ({ ...prev, [index]: searchValue }));

      // If search value doesn't match any city exactly, switch to custom input
      if (searchValue && searchValue.length > 2) {
        const exactMatch = cities.find(
          (c) =>
            c.city_name.toLowerCase() === searchValue.toLowerCase() ||
            c.city_code.toLowerCase() === searchValue.toLowerCase(),
        );
        // Check if any city starts with or contains the search value
        const partialMatch = cities.find(
          (c) =>
            c.city_name.toLowerCase().startsWith(searchValue.toLowerCase()) ||
            c.city_code.toLowerCase().startsWith(searchValue.toLowerCase()),
        );

        // If no exact or partial match found, switch to custom input
        if (!exactMatch && !partialMatch) {
          setCustomCities((prev) => ({ ...prev, [index]: true }));
          // Also update the form with the custom value
          const formattedValue = toTitleCase(searchValue);
          customerForm.setFieldValue(
            `addresses_data.${index}.city`,
            formattedValue,
          );
          addressForm.setFieldValue(
            `addresses_data.${index}.city`,
            formattedValue,
          );
        } else if (exactMatch || partialMatch) {
          // If there's a match, ensure we're in dropdown mode
          setCustomCities((prev) => ({ ...prev, [index]: false }));
        }
      } else if (!searchValue) {
        // Clear search value
        setCitySearchValues((prev) => ({ ...prev, [index]: "" }));
      }
    },
    [cities, customerForm, addressForm],
  );

  // Handle clearing custom city and switching back to dropdown
  const handleClearCustomCity = useCallback(
    (index: number) => {
      setCustomCities((prev) => ({ ...prev, [index]: false }));
      setCitySearchValues((prev) => ({ ...prev, [index]: "" }));
      // Clear the city value in forms
      customerForm.setFieldValue(`addresses_data.${index}.city`, "");
      addressForm.setFieldValue(`addresses_data.${index}.city`, "");
    },
    [customerForm, addressForm],
  );

  const createCustomer = async (values: CustomerSubmitValues): Promise<void> => {
    try {
      setIsSubmitting(true);
      const payload = {
        customer_name: values.customer_name,
        customer_type_code: values.customer_type_code,
        term_code: values.term_code,
        own_office: values.own_office === "true",
        status: "ACTIVE",
        assigned_to: values.assigned_to,
        network_id: values.network_id ? Number(values.network_id) : null,
        addresses_data: values.addresses_data.map((addr) => ({
          ...addr,
          address_type:
            addr.address_type === "Primary" ? "Primary" : addr.address_type,
          pan_no: addr.pan_no ?? "",
          gst_id: addr.gst_id ?? "",
          tan_no: addr.tan_no ?? "",
          arn_no: addr.arn_no ?? "",
          uin_no: addr.uin_no ?? "",
          gst_registration_status: addr.gst_registration_status ?? "",
          composite_regular: addr.composite_regular ?? "",
          sez: Boolean(addr.sez),
          ...(isVendorMasterRoute
            ? {
                pan_aadhaar_link: Boolean(addr.pan_aadhaar_link),
                Itr_filed: addr.Itr_filed ?? "",
                tds_threshold_flag: Boolean(addr.tds_threshold_flag),
              }
            : {}),
        })),
        ...(isVendorMasterRoute
          ? { tds_type: tdsType, tds_section_data: values.tds_section_data ?? [] }
          : {}),
      };

      const res = await postAPICall(URL.customer, payload, API_HEADER);
      if (res) {
        ToastNotification({
          type: "success",
          message: "Customer created successfully",
        });
        navigate(baseMasterPath, { state: { refreshData: true } });
      }
    } catch (err: unknown) {
      const debugMessage =
        err && typeof err === "object" && "message" in err
          ? (err as { message?: unknown }).message
          : undefined;
      console.log("🔍 CustomerCreate - createCustomer Error Caught:", {
        err,
        errType: typeof err,
        isError: err instanceof Error,
        hasMessage: err && typeof err === "object" && "message" in err,
        message: debugMessage,
      });

      // Extract error message from various error formats
      let errorMessage = "Unknown error";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === "object" && "message" in err) {
        const msg = (err as { message?: unknown }).message;
        errorMessage = typeof msg === "string" ? msg : String(msg);
      }

      console.log(
        "🔍 CustomerCreate - Final error message to display:",
        errorMessage,
      );

      ToastNotification({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCustomer = async (values: CustomerSubmitValues): Promise<void> => {
    try {
      setIsSubmitting(true);
      const payload = {
        id: customerData.id,
        customer_name: values.customer_name,
        customer_type_code: values.customer_type_code,
        term_code: values.term_code,
        own_office: values.own_office === "true",
        status: "ACTIVE",
        assigned_to: values.assigned_to,
        network_id: values.network_id ? Number(values.network_id) : null,
        addresses_data: values.addresses_data.map((addr) => {
          const addressPayload: AddressData & { id?: number } = {
            ...addr,
            address_type:
              addr.address_type === "Primary" ? "Primary" : addr.address_type,
            pan_no: addr.pan_no ?? "",
            gst_id: addr.gst_id ?? "",
            tan_no: addr.tan_no ?? "",
            arn_no: addr.arn_no ?? "",
            uin_no: addr.uin_no ?? "",
            gst_registration_status: addr.gst_registration_status ?? "",
            composite_regular: addr.composite_regular ?? "",
            sez: Boolean(addr.sez),
            ...(isVendorMasterRoute
              ? {
                  pan_aadhaar_link: Boolean(addr.pan_aadhaar_link),
                  Itr_filed: addr.Itr_filed ?? "",
                  tds_threshold_flag: Boolean(addr.tds_threshold_flag),
                }
              : {}),
          };

          // Include id if it exists (for existing addresses in edit mode)
          if (addr.id !== undefined && addr.id !== null) {
            addressPayload.id = addr.id;
          }

          return addressPayload;
        }),
        ...(isVendorMasterRoute
          ? { tds_type: tdsType, tds_section_data: values.tds_section_data ?? [] }
          : {}),
        // },
      };

      const res = await putAPICall(URL.customer, payload, API_HEADER);
      if (res) {
        ToastNotification({
          type: "success",
          message: "Customer updated successfully",
        });
        navigate(baseMasterPath, { state: { refreshData: true } });
      }
    } catch (err: unknown) {
      const debugMessage =
        err && typeof err === "object" && "message" in err
          ? (err as { message?: unknown }).message
          : undefined;
      console.log("🔍 CustomerCreate - updateCustomer Error Caught:", {
        err,
        errType: typeof err,
        isError: err instanceof Error,
        hasMessage: err && typeof err === "object" && "message" in err,
        message: debugMessage,
      });

      // Extract error message from various error formats
      let errorMessage = "Unknown error";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === "object" && "message" in err) {
        const msg = (err as { message?: unknown }).message;
        errorMessage = typeof msg === "string" ? msg : String(msg);
      }

      console.log(
        "🔍 CustomerCreate - Final error message to display:",
        errorMessage,
      );

      ToastNotification({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = () => {
    // Skip validation in view mode since all fields are readonly
    if (isViewMode) {
      return;
    }

    // Validate both forms before final submission
    const customerResult = customerForm.validate();
    const addressResult = addressForm.validate();
    const tdsResult = isVendorMasterRoute ? tdsDisplayForm.validate() : null;

    if (
      !customerResult.hasErrors &&
      !addressResult.hasErrors &&
      (!isVendorMasterRoute || (tdsResult && !tdsResult.hasErrors))
    ) {
      // Combine data from both forms
      if (customerForm.values.assigned_to === "Agent") {
        customerForm.values.assigned_to = "";
      }
      const finalData: CustomerSubmitValues = {
        ...customerForm.values,
        addresses_data: addressForm.values.addresses_data,
      };

      if (isVendorMasterRoute) {
        finalData.tds_section_data = (tdsDisplayForm.values.tds_sections || [])
          .filter((r) => r.section_id != null)
          .map((r) => ({
            ...(r.id != null ? { id: r.id } : {}),
            section_id: Number(r.section_id),
            exemption_tds: Boolean(r.exemption_tds),
            exemption_certificate_no: r.exemption_tds
              ? r.exemption_certificate_no?.trim() || null
              : null,
            tds_percentage: r.exemption_tds
              ? (() => {
                  const v = normalizeTwoDecimalString(r.tds_percent || "");
                  return v ? v : null;
                })()
              : null,
            valid_from: r.exemption_tds
              ? formatDateYYYYMMDD(r.valid_from)
              : null,
            valid_to: r.exemption_tds ? formatDateYYYYMMDD(r.valid_to) : null,
            tds_lower_limit: r.exemption_tds
              ? (() => {
                  const v = normalizeTwoDecimalString(r.tds_lower_limit || "");
                  return v ? v : null;
                })()
              : null,
          }));
      }

      // Decide between create and update strictly based on route mode,
      // so PAN-based prefill (which passes customerData without id) still uses create flow.
      if (isEditMode && customerId) {
        updateCustomer(finalData);
      } else {
        createCustomer(finalData);
      }
    } else {
      // Force re-render to show validation errors inline
      if (customerResult.hasErrors) {
        customerForm.validate();
        setActive(0);
      }
      if (addressResult.hasErrors) {
        addressForm.validate();
        if (!customerResult.hasErrors) setActive(1);
      }
      if (isVendorMasterRoute && tdsResult?.hasErrors) {
        tdsDisplayForm.validate();
        if (!customerResult.hasErrors && !addressResult.hasErrors) setActive(2);
      }

      // Show validation errors in console for debugging
      console.log("Customer form errors:", customerResult.errors);
      console.log("Address form errors:", addressResult.errors);
      if (isVendorMasterRoute) {
        console.log("TDS form errors:", tdsDisplayForm.errors);
      }
    }
  };

  if (isLoading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" color="#105476" />
          <Text c="dimmed">Loading form data...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box p="md" maw={1200} mx="auto" style={{ position: "relative" }}>
      {/* Loading Overlay */}
      {isSubmitting && (
        <Box
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            borderRadius: 8,
          }}
        >
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed" fw={500}>
              {isCreateMode
                ? isVendorMasterRoute
                  ? "Creating Vendor..."
                  : "Creating Customer..."
                : isVendorMasterRoute
                  ? "Updating Vendor..."
                  : "Updating Customer..."}
            </Text>
          </Stack>
        </Box>
      )}

      {/* Header */}
      <Group justify="space-between" align="center" mb="lg">
        <Text size="xl" fw={600} c="#105476">
          {isCreateMode
            ? isVendorMasterRoute
              ? "Create Vendor"
              : "Create Customer"
            : isEditMode
              ? isVendorMasterRoute
                ? "Edit Vendor"
                : "Edit Customer"
              : isVendorMasterRoute
                ? "View Vendor"
                : "View Customer"}
        </Text>

        {!isViewMode && (
          <Button
            rightSection={<IconCheck size={16} />}
            onClick={handleFinalSubmit}
            color="teal"
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isCreateMode ? "Create" : "Update"}
          </Button>
        )}
      </Group>

      <Tabs
        value={String(active)}
        onChange={(v) => v !== null && setActive(Number(v))}
        color="#105476"
      >
        <Tabs.List
          mb="md"
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            borderBottom: "none",
          }}
        >
          <Tabs.Tab
            value="0"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 0 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 0 ? 600 : 400,
            }}
          >
            {isVendorMasterRoute ? "Vendor Master" : "Customer Master"}
          </Tabs.Tab>

          <Tabs.Tab
            value="1"
            style={{
              textAlign: "center",
              padding: "12px",
              backgroundColor: "transparent",
              borderBottom: active === 1 ? "3px solid #105476" : "none",
              color: "#105476",
              fontSize: 16,
              fontWeight: active === 1 ? 600 : 400,
            }}
          >
            Address
          </Tabs.Tab>

          {isVendorMasterRoute && (
            <Tabs.Tab
              value="2"
              style={{
                textAlign: "center",
                padding: "12px",
                backgroundColor: "transparent",
                borderBottom: active === 2 ? "3px solid #105476" : "none",
                color: "#105476",
                fontSize: 16,
                fontWeight: active === 2 ? 600 : 400,
              }}
            >
              TDS Section
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="0">
          <Box mt="md">
            <Card shadow="sm" padding="lg" radius="md">
              <Grid gutter={"sm"}>
                <Grid.Col span={4}>
                  <TextInput
                    label={isVendorMasterRoute ? "Vendor Name" : "Customer Name"}
                    withAsterisk
                    placeholder={
                      isVendorMasterRoute
                        ? "Enter vendor name"
                        : "Enter customer name"
                    }
                    disabled={!!isViewMode}
                    value={customerForm.values.customer_name}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      customerForm.setFieldValue(
                        "customer_name",
                        formattedValue,
                      );
                    }}
                    error={customerForm.errors.customer_name}
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <MultiSelect
                    label={isVendorMasterRoute ? "Vendor Type" : "Customer Type"}
                    withAsterisk
                    placeholder={
                      isVendorMasterRoute
                        ? "Select vendor type"
                        : "Select customer type"
                    }
                    searchable
                    data={customerTypeOptions}
                    disabled={!!isViewMode}
                    {...customerForm.getInputProps("customer_type_code")}
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <Select
                    label="Credit Type"
                    withAsterisk
                    placeholder="Select credit type"
                    data={termCodeOptions}
                    disabled={isViewMode}
                    {...customerForm.getInputProps("term_code")}
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <Select
                    label="Own Office"
                    data={[
                      { value: "true", label: "Yes" },
                      { value: "false", label: "No" },
                    ]}
                    withAsterisk
                    placeholder="Select Own Office"
                    disabled={isViewMode}
                    {...customerForm.getInputProps("own_office")}
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <SearchableSelect
                    label="Network Name"
                    placeholder="Search network..."
                    apiEndpoint={URL.networkMaster}
                    value={customerForm.values.network_id || null}
                    displayValue={customerForm.values.network_name || null}
                    onChange={(value, selectedData) => {
                      customerForm.setFieldValue("network_id", value ?? "");
                      customerForm.setFieldValue("network_name", selectedData?.label ?? "");
                    }}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id ?? ""),
                      label: String(item.network_name ?? ""),
                    })}
                    searchFields={["network_name"]}
                    dropdownZIndex={1000}
                    minSearchLength={1}
                    disabled={!!isViewMode}
                  />
                </Grid.Col>

                {(!customerForm.values.customer_type_code?.length ||
                  customerForm.values.customer_type_code.find((value) => {
                    const option = customerTypeOptions.find(
                      (o) => o.value === value,
                    );
                    return (
                      option?.label?.toLowerCase() === "agent" ||
                      value?.toLowerCase() === "agent"
                    );
                  }) == null) && (
                  <Grid.Col span={4}>
                    <Dropdown
                      label="Assign To"
                      key={customerForm.key("assigned_to")}
                      placeholder="Select Salesperson"
                      searchable
                      data={salespersonsData}
                      disabled={isViewMode}
                      nothingFoundMessage="No salespersons found"
                      {...customerForm.getInputProps("assigned_to")}
                      onChange={(value) => {
                        customerForm.setFieldValue("assigned_to", value || "");
                      }}
                    />
                  </Grid.Col>
                )}
              </Grid>

              <Group justify="space-between" mt="xl">
                <Button
                  variant="outline"
                  color="#105476"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => navigate(baseMasterPath)}
                >
                  {isVendorMasterRoute
                    ? "Back to Vendor List"
                    : "Back to Customer List"}
                </Button>
                <Group>
                  <Button
                    variant="default"
                    onClick={() => setActive(1)}
                    rightSection={<IconArrowRight size={14} />}
                    disabled={isSubmitting}
                  >
                    Next
                  </Button>
                </Group>
              </Group>
            </Card>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="1">
          <Box mt="md">
            <Card shadow="sm" padding="xs" radius="md">
              {/* <Text size="sm" fw={500}>
                Address
              </Text> */}

              <Stack>
                {addressForm.values.addresses_data.map((_, index) => (
                  <AddressCard
                    key={`address-${index}-${addressForm.values.addresses_data[index]?.city || ""}-${addressStateRestored}`}
                    index={index}
                    isViewMode={isViewMode}
                    isVendorMasterRoute={isVendorMasterRoute}
                    addressForm={addressForm}
                    countryOptions={countryOptions}
                    selectedCountries={selectedCountries}
                    getStateOptions={getStateOptions}
                    getStateValue={getStateValue}
                    cityOptions={cityOptions}
                    getCityValue={getCityValue}
                    handleCountryChange={handleCountryChange}
                    handleStateChange={handleStateChange}
                    handleCityChange={handleCityChange}
                    handleCustomCityChange={handleCustomCityChange}
                    handleCitySearch={handleCitySearch}
                    handleClearCustomCity={handleClearCustomCity}
                    customCities={customCities}
                    citySearchValues={citySearchValues}
                    onRemove={removeAddress}
                    canRemove={addressForm.values.addresses_data.length > 1}
                  />
                ))}
              </Stack>

              <Group justify="right" mt="md">
                <Button
                  variant="outline"
                  leftSection={<IconPlus size={16} />}
                  onClick={addAddress}
                  disabled={isViewMode}
                  color="#105476"
                >
                  Add Address
                </Button>
              </Group>

              <Group justify="space-between" mt="xl">
                <Button
                  variant="default"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => setActive(0)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Group>
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => navigate(baseMasterPath)}
                    disabled={isSubmitting}
                  >
                    {isViewMode ? "Back to List" : "Cancel"}
                  </Button>
                  {isCreateMode && !isViewMode && (
                    <Button
                      bg="#105476"
                      onClick={() => {
                        // Validate both forms before navigating to relationship mapping
                        const customerResult = customerForm.validate();
                        const addressResult = addressForm.validate();

                        if (
                          !customerResult.hasErrors &&
                          !addressResult.hasErrors
                        ) {
                          // Navigate to customer relationship mapping with customer form data
                          navigate(
                            "/master/customer-relationship-mapping/create",
                            {
                              state: {
                                fromCustomerMaster: true,
                                customerFormData: customerForm.values,
                                addressFormData: addressForm.values,
                              },
                            },
                          );
                        } else {
                          // Force re-render to show validation errors inline
                          if (customerResult.hasErrors) {
                            customerForm.validate();
                          }
                          if (addressResult.hasErrors) {
                            addressForm.validate();
                          }
                        }
                      }}
                      disabled={isSubmitting}
                      style={{ border: "1px solid #105476" }}
                      color="white"
                    >
                      {isVendorMasterRoute
                        ? "Add Vendor Relationships"
                        : "Add Customer Relationships"}
                    </Button>
                  )}
                  {isEditMode && !isViewMode && customerId && (
                    <Button
                      bg="#105476"
                      onClick={() => {
                        // Validate both forms before navigating to relationship mapping
                        const customerResult = customerForm.validate();
                        const addressResult = addressForm.validate();

                        if (
                          !customerResult.hasErrors &&
                          !addressResult.hasErrors
                        ) {
                          // Navigate to customer relationship mapping edit with customer_id
                          navigate(
                            "/master/customer-relationship-mapping/edit",
                            {
                              state: {
                                customer_id: Number(customerId),
                                fromCustomerMaster: true,
                                customerFormData: customerForm.values,
                                addressFormData: addressForm.values,
                              },
                            },
                          );
                        } else {
                          // Force re-render to show validation errors inline
                          if (customerResult.hasErrors) {
                            customerForm.validate();
                          }
                          if (addressResult.hasErrors) {
                            addressForm.validate();
                          }
                        }
                      }}
                      disabled={isSubmitting}
                      style={{ border: "1px solid #105476" }}
                      color="white"
                    >
                      {isVendorMasterRoute
                        ? "Edit Vendor Relationships"
                        : "Edit Customer Relationships"}
                    </Button>
                  )}
                  {isVendorMasterRoute && !isViewMode && (
                    <Button
                      rightSection={<IconArrowRight size={14} />}
                      onClick={() => setActive(2)}
                      color="#105476"
                      disabled={isSubmitting}
                    >
                      Next
                    </Button>
                  )}

                </Group>
              </Group>
            </Card>
          </Box>
        </Tabs.Panel>

        {isVendorMasterRoute && (
          <Tabs.Panel value="2">
            <Box mt="md">
              <Card shadow="sm" padding="lg" radius="md">
                <Stack gap="md">
                  <Grid gutter="sm">
                    <Grid.Col span={4}>
                      <Select
                        label="TDS Type"
                        placeholder="Select TDS type"
                        data={[
                          { value: "Company", label: "Company" },
                          { value: "Individual", label: "Individual" },
                          { value: "Partnership", label: "Partnership" },
                        ]}
                        disabled={isViewMode}
                        value={tdsType}
                        onChange={(v) =>
                          setTdsType(
                            (v as "Company" | "Individual" | "Partnership" | "") ??
                              "",
                          )
                        }
                      />
                    </Grid.Col>
                  </Grid>

                  {tdsDisplayForm.values.tds_sections.map((_, index) => (
                    <Card
                      key={index}
                      withBorder
                      padding="md"
                      radius="md"
                      bg="#fafafa"
                    >
                      <Group justify="space-between" align="center" mb="sm">
                        <Text size="sm" fw={600} c="#105476">
                          TDS Section {index + 1}
                        </Text>
                        {!isViewMode &&
                          tdsDisplayForm.values.tds_sections.length > 1 && (
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() =>
                                tdsDisplayForm.removeListItem(
                                  "tds_sections",
                                  index,
                                )
                              }
                              aria-label="Remove TDS section"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          )}
                      </Group>
                      <Grid gutter="sm">
                        <Grid.Col span={4}>
                          <Select
                            label="Section Name"
                            placeholder="Select section name"
                            searchable
                            disabled={isViewMode}
                            data={tdsSectionOptions}
                            value={
                              tdsDisplayForm.values.tds_sections[index]
                                ?.section_id != null
                                ? String(
                                    tdsDisplayForm.values.tds_sections[index]
                                      ?.section_id,
                                  )
                                : ""
                            }
                            onChange={(value) => {
                              const selected = tdsSectionOptions.find(
                                (o) => o.value === value,
                              );
                              const sectionId =
                                value != null && value !== ""
                                  ? Number(value)
                                  : null;
                              tdsDisplayForm.setFieldValue(
                                `tds_sections.${index}.section_id`,
                                sectionId,
                              );
                              tdsDisplayForm.setFieldValue(
                                `tds_sections.${index}.id`,
                                sectionId != null
                                  ? tdsIdBySectionId[sectionId] ?? null
                                  : null,
                              );
                              tdsDisplayForm.setFieldValue(
                                `tds_sections.${index}.section_code`,
                                selected?.section_code || "",
                              );
                              tdsDisplayForm.setFieldValue(
                                `tds_sections.${index}.section_name`,
                                selected?.label || "",
                              );
                            }}
                            error={
                              tdsDisplayForm.getInputProps(
                                `tds_sections.${index}.section_id`,
                              ).error
                            }
                            styles={{
                              input: { fontSize: "13px", fontFamily: "Inter" },
                              label: {
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "#424242",
                                marginBottom: "4px",
                                fontFamily: "Inter",
                              },
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <TextInput
                            label="Section Code"
                            placeholder="Section code"
                            disabled
                            {...tdsDisplayForm.getInputProps(
                              `tds_sections.${index}.section_code`,
                            )}
                            styles={{
                              input: { fontSize: "13px", fontFamily: "Inter" },
                              label: {
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "#424242",
                                marginBottom: "4px",
                                fontFamily: "Inter",
                              },
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <Box pt={30}>
                            <Switch
                              label="Exemption TDS"
                              description={
                                tdsDisplayForm.values.tds_sections[index]
                                  ?.exemption_tds
                                  ? "Yes"
                                  : "No"
                              }
                              disabled={isViewMode}
                              checked={Boolean(
                                tdsDisplayForm.values.tds_sections[index]
                                  ?.exemption_tds,
                              )}
                              onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                tdsDisplayForm.setFieldValue(
                                  `tds_sections.${index}.exemption_tds`,
                                  checked,
                                );

                                // When exemption is turned off, clear dependent fields
                                // so payload does not carry stale values.
                                if (!checked) {
                                  tdsDisplayForm.setFieldValue(
                                    `tds_sections.${index}.exemption_certificate_no`,
                                    "",
                                  );
                                  tdsDisplayForm.setFieldValue(
                                    `tds_sections.${index}.tds_percent`,
                                    "",
                                  );
                                  tdsDisplayForm.setFieldValue(
                                    `tds_sections.${index}.valid_from`,
                                    null,
                                  );
                                  tdsDisplayForm.setFieldValue(
                                    `tds_sections.${index}.valid_to`,
                                    null,
                                  );
                                  tdsDisplayForm.setFieldValue(
                                    `tds_sections.${index}.tds_lower_limit`,
                                    "",
                                  );
                                }
                              }}
                            />
                          </Box>
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <TextInput
                            label="Exemption Certificate No"
                            placeholder="Certificate number"
                            disabled={
                              isViewMode ||
                              !tdsDisplayForm.values.tds_sections[index]
                                ?.exemption_tds
                            }
                            withAsterisk={Boolean(
                              tdsDisplayForm.values.tds_sections[index]
                                ?.exemption_tds,
                            )}
                            {...tdsDisplayForm.getInputProps(
                              `tds_sections.${index}.exemption_certificate_no`,
                            )}
                            styles={{
                              input: { fontSize: "13px", fontFamily: "Inter" },
                              label: {
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "#424242",
                                marginBottom: "4px",
                                fontFamily: "Inter",
                              },
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <TextInput
                            label="TDS %"
                            placeholder="TDS %"
                            disabled={
                              isViewMode ||
                              !tdsDisplayForm.values.tds_sections[index]
                                ?.exemption_tds
                            }
                            withAsterisk={Boolean(
                              tdsDisplayForm.values.tds_sections[index]
                                ?.exemption_tds,
                            )}
                            inputMode="decimal"
                            value={
                              tdsDisplayForm.values.tds_sections[index]
                                ?.tds_percent ?? ""
                            }
                            onChange={(e) => {
                              const v = e.currentTarget.value.trim();
                              if (v === "" || twoDecimalInputRegex.test(v)) {
                                tdsDisplayForm.setFieldValue(
                                  `tds_sections.${index}.tds_percent`,
                                  v,
                                );
                              }
                            }}
                            error={
                              tdsDisplayForm.getInputProps(
                                `tds_sections.${index}.tds_percent`,
                              ).error
                            }
                            styles={{
                              input: { fontSize: "13px", fontFamily: "Inter" },
                              label: {
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "#424242",
                                marginBottom: "4px",
                                fontFamily: "Inter",
                              },
                            }}
                          />
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <SingleDateInput
                            label="Valid From"
                            placeholder="Valid from"
                            disabled={
                              isViewMode ||
                              !tdsDisplayForm.values.tds_sections[index]
                                ?.exemption_tds
                            }
                            value={
                              tdsDisplayForm.values.tds_sections[index]
                                ?.valid_from ?? null
                            }
                            onChange={(value) =>
                              tdsDisplayForm.setFieldValue(
                                `tds_sections.${index}.valid_from`,
                                value,
                              )
                            }
                            error={
                              tdsDisplayForm.getInputProps(
                                `tds_sections.${index}.valid_from`,
                              ).error
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <SingleDateInput
                            label="Valid To"
                            placeholder="Valid to"
                            disabled={
                              isViewMode ||
                              !tdsDisplayForm.values.tds_sections[index]
                                ?.exemption_tds
                            }
                            value={
                              tdsDisplayForm.values.tds_sections[index]
                                ?.valid_to ?? null
                            }
                            onChange={(value) =>
                              tdsDisplayForm.setFieldValue(
                                `tds_sections.${index}.valid_to`,
                                value,
                              )
                            }
                            error={
                              tdsDisplayForm.getInputProps(
                                `tds_sections.${index}.valid_to`,
                              ).error
                            }
                          />
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <TextInput
                            label="TDS Lower Limit"
                            placeholder="TDS lower limit"
                            disabled={
                              isViewMode ||
                              !tdsDisplayForm.values.tds_sections[index]
                                ?.exemption_tds
                            }
                            withAsterisk={Boolean(
                              tdsDisplayForm.values.tds_sections[index]
                                ?.exemption_tds,
                            )}
                            inputMode="decimal"
                            value={
                              tdsDisplayForm.values.tds_sections[index]
                                ?.tds_lower_limit ?? ""
                            }
                            onChange={(e) => {
                              const v = e.currentTarget.value.trim();
                              if (v === "" || twoDecimalInputRegex.test(v)) {
                                tdsDisplayForm.setFieldValue(
                                  `tds_sections.${index}.tds_lower_limit`,
                                  v,
                                );
                              }
                            }}
                            error={
                              tdsDisplayForm.getInputProps(
                                `tds_sections.${index}.tds_lower_limit`,
                              ).error
                            }
                            styles={{
                              input: { fontSize: "13px", fontFamily: "Inter" },
                              label: {
                                fontSize: "13px",
                                fontWeight: 500,
                                color: "#424242",
                                marginBottom: "4px",
                                fontFamily: "Inter",
                              },
                            }}
                          />
                        </Grid.Col>
                      </Grid>
                    </Card>
                  ))}

                  <Group justify="flex-end">
                    <Button
                      variant="outline"
                      leftSection={<IconPlus size={16} />}
                      onClick={() =>
                        tdsDisplayForm.insertListItem(
                          "tds_sections",
                          emptyTdsSectionRow(),
                        )
                      }
                      disabled={isViewMode}
                      color="#105476"
                    >
                      Add
                    </Button>
                  </Group>
                </Stack>

                <Group justify="space-between" mt="xl">
                  <Button
                    variant="default"
                    leftSection={<IconArrowLeft size={16} />}
                    onClick={() => setActive(1)}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <Group>
                    <Button
                      variant="outline"
                      color="#105476"
                      onClick={() => navigate(baseMasterPath)}
                      disabled={isSubmitting}
                    >
                      {isViewMode ? "Back to List" : "Cancel"}
                    </Button>
                    {!isViewMode && (
                      <Box />
                    )}
                  </Group>
                </Group>
              </Card>
            </Box>
          </Tabs.Panel>
        )}
      </Tabs>
    </Box>
  );
}

export default CustomerCreate;
