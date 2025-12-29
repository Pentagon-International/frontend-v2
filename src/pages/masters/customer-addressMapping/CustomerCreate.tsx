import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { Dropdown, ToastNotification } from "../../../components";
import { API_HEADER } from "../../../store/storeKeys";
import { URL } from "../../../api/serverUrls";
import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  Stack,
  Stepper,
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
  latitude?: number;
  longitude?: number;
};

type CustomerFormData = {
  customer_name: string;
  customer_type_code: string;
  term_code: string;
  own_office: string;
  assigned_to: string;
  // assigned_to_display: string;
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

// Separate validation schemas for each form
const customerValidationSchema = yup.object({
  customer_name: yup
    .string()
    .required("Customer name is required")
    .min(3, "Customer name must be at least 3 characters")
    .max(100, "Customer name must not exceed 100 characters"),
  customer_type_code: yup.string().required("Customer type is required"),
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
            "Please select a valid address type"
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
            "Phone number can only contain digits, spaces, hyphens, plus signs, and parentheses"
          )
          .max(20, "Phone number must not exceed 20 characters"), // Optional - lanline number
        mobile_no: yup
          .string()
          .required("Mobile number is required")
          .matches(
            /^[\d\s\-+()]+$/,
            "Mobile number can only contain digits, spaces, hyphens, plus signs, and parentheses"
          )
          .min(10, "Mobile number must be at least 10 digits")
          .max(15, "Mobile number must not exceed 15 digits"),
        email: yup
          .string()
          .email("Please enter a valid email address")
          .required("Email is required")
          .max(100, "Email must not exceed 100 characters"),
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
      })
    )
    .min(1, "At least one address is required"),
});

// Term code options
const termCodeOptions = [
  { label: "CREDIT", value: "CREDIT" },
  { label: "CASH", value: "CASH" },
  { label: "PREPAID", value: "PREPAID" },
];

// Memoized AddressCard component for better performance
const AddressCard = memo(
  ({
    index,
    isViewMode,
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
    getCityName,
    onRemove,
    canRemove,
  }: {
    index: number;
    isViewMode: boolean;
    addressForm: UseFormReturnType<{ addresses_data: AddressData[] }>;
    countryOptions: { value: string; label: string }[];
    selectedCountries: Record<number, string>;
    getStateOptions: (
      countryCode: string
    ) => { value: string; label: string }[];
    getStateValue: (index: number) => string;
    cityOptions: { value: string; label: string }[];
    getCityValue: (cityName: string) => string;
    getCityName: (cityValue: string) => string;
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
        <Grid>
          <Grid.Col span={4}>
            <TextInput
              label="Location"
              placeholder="Enter location"
              disabled={!!isViewMode}
              value={addressForm.values.addresses_data[index]?.customer_location || ""}
              onChange={(e) => {
                const formattedValue = toTitleCase(e.target.value);
                addressForm.setFieldValue(
                  `addresses_data.${index}.customer_location`,
                  formattedValue
                );
              }}
              error={addressForm.errors.addresses_data?.[index]?.customer_location}
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
                `addresses_data.${index}.address_type`
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
                  formattedValue
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
                  citySearchValues[index] !== undefined && citySearchValues[index] !== ""
                    ? citySearchValues[index]
                    : addressForm.values.addresses_data[index]?.city || ""
                }
                onChange={(e) => {
                  const formattedValue = toTitleCase(e.target.value);
                  handleCustomCityChange(index, formattedValue);
                }}
                error={addressForm.errors.addresses_data?.[index]?.city}
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
                key={`city-select-${index}-${addressForm.values.addresses_data[index]?.city || ''}`}
                label="City"
                placeholder="Select or search city"
                searchable
                data={cityOptions}
                disabled={isViewMode}
                value={
                  addressForm.values.addresses_data[index]?.city
                    ? getCityValue(addressForm.values.addresses_data[index].city)
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
                `addresses_data.${index}.mobile_no`
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
    );
  }
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
    new Date().toISOString()
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
    {}
  );
  const [customCities, setCustomCities] = useState<Record<number, boolean>>(
    {}
  );
  const [citySearchValues, setCitySearchValues] = useState<
    Record<number, string>
  >({});
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [addressStateRestored, setAddressStateRestored] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const customerData = location.state?.customerData;

  // Determine the mode based on route parameters
  const isEditMode = Boolean(params.id && location.pathname.includes("/edit/"));
  const isViewMode = Boolean(params.id && location.pathname.includes("/view/"));
  const isCreateMode = !params.id;

  // Customer ID from route parameters
  const customerId = params.id;
  
  // Salespersons data query - initially with empty customer_id
  const { data: rawSalespersonsData = []} =
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

  // Fetch countries data
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          `${URL.country}`,
          API_HEADER
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
          API_HEADER
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
          API_HEADER
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
          API_HEADER
        )) as CustomerTypeApiResponse;

        // Handle the API response structure
        if (response && response.success && Array.isArray(response.data)) {
          return response.data.filter((type) => type.status === "ACTIVE");
        }

        // Fallback for different response structure
        if (Array.isArray(response)) {
          return (response as CustomerTypeData[]).filter(
            (type) => type.status === "ACTIVE"
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
    return customerTypes.map((type) => ({
      value: type.customer_type_code,
      label: type.customer_type_name,
    }));
  }, [customerTypes]);

  // Memoize country options
  const countryOptions = useMemo(() => {
    return countries
      .filter((country) => country.status === "ACTIVE")
      .map((country) => ({
        value: country.country_code,
        label: country.country_name,
      }));
  }, [countries]);

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
      customer_type_code: "",
      term_code: "",
      own_office: "",
      assigned_to: "",
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
      let addressDataToRestore = restoredAddressData?.addresses_data || restoredCustomerData?.addresses_data || [];
      
      // Normalize city values if cities are already loaded (for immediate display)
      if (cities.length > 0 && addressDataToRestore.length > 0) {
        addressDataToRestore = addressDataToRestore.map((addr: AddressData) => {
          if (addr.city) {
            const city = cities.find(
              (c) => c.city_name === addr.city || c.city_code === addr.city
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
          customer_type_code: restoredCustomerData.customer_type_code || "",
          term_code: restoredCustomerData.term_code || "",
          own_office: restoredCustomerData.own_office || "",
          assigned_to: restoredCustomerData.assigned_to || "",
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
              (c) => c.country_name === addr.country || c.country_code === addr.country
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
              (c) => c.city_name === addr.city || c.city_code === addr.city
            );
            
            if (city) {
              // City exists in dropdown - use city_name for consistency
              cityValue = city.city_name;
              newCustomCities[idx] = false; // Use dropdown
              newCitySearchValues[idx] = ""; // Clear search value
              
              // Update form value to city_name to ensure dropdown displays correctly
              addressForm.setFieldValue(`addresses_data.${idx}.city`, cityValue);
              customerForm.setFieldValue(`addresses_data.${idx}.city`, cityValue);
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
  }, [location.state, isFormInitialized, addressStateRestored, countries, states, cities, addressForm]);


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
            credit_type?: string;
          };

          // Process the fetched data
          const addressData = fetchedCustomerData.addresses_data?.map(
            (
              addr: AddressData & {
                location?: string;
                landline?: string;
                phone?: string;
                mobile?: string;
              }
            ) => {
              // Preserve original city value from API
              const originalCityValue = addr.city || "";
              let cityName = originalCityValue;
              
              // Try to convert city_code to city_name if it exists in dropdown
              if (cityName) {
                const city = cities.find(
                  (c) => c.city_code === cityName || c.city_name === cityName
                );
                if (city) {
                  // City exists in dropdown - use city_name for consistency
                  cityName = city.city_name;
                }
                // If city not found, keep original value (could be city_code or custom city name)
              }
              return {
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
                latitude: addr.latitude || 0,
                longitude: addr.longitude || 0,
              };
            }
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
              latitude: 0,
              longitude: 0,
            },
          ];

          const formData = {
            customer_name:
              fetchedCustomerData.customer_name ||
              fetchedCustomerData.name ||
              "",
            customer_type_code:
              fetchedCustomerData.customer_type_code ||
              fetchedCustomerData.customer_type ||
              "",
            term_code:
              fetchedCustomerData.term_code ||
              fetchedCustomerData.credit_type ||
              "",
            own_office: fetchedCustomerData.own_office ? "true" : "false",
            assigned_to: fetchedCustomerData.assigned_to_display || "",
            addresses_data: addressData,
          };

          // Set customer form data
          customerForm.setValues({
            customer_name: formData.customer_name,
            customer_type_code: formData.customer_type_code,
            term_code: formData.term_code,
            own_office: formData.own_office,
            assigned_to: formData.assigned_to,
            addresses_data: formData.addresses_data,
          });

          // Set address form data
          addressForm.setValues({
            addresses_data: formData.addresses_data,
          });

          // Initialize selected countries and states for cascading dropdowns
          const newSelectedCountries: Record<number, string> = {};
          const newSelectedStates: Record<number, string> = {};
          const newCustomCities: Record<number, boolean> = {};
          const newCitySearchValues: Record<number, string> = {};

          addressData.forEach((addr, idx) => {
            if (addr.country) {
              const country = countries.find(
                (c) => c.country_name === addr.country
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
                (c) => c.city_name === addr.city || c.city_code === addr.city
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
    [countries, customerTypes, cities] // Added countries and cities dependency (forms excluded to prevent infinite loops)
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
          }
        ) => {
          // Preserve original city value from API
          const originalCityValue = addr.city || "";
          let cityName = originalCityValue;
          
          // Try to convert city_code to city_name if it exists in dropdown
          if (cityName) {
            const city = cities.find(
              (c) => c.city_code === cityName || c.city_name === cityName
            );
            if (city) {
              // City exists in dropdown - use city_name for consistency
              cityName = city.city_name;
            }
            // If city not found, keep original value (could be city_code or custom city name)
          }
          return {
            id: (addr as any).id, // Include id if it exists (for edit mode)
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
            latitude: addr.latitude || 0,
            longitude: addr.longitude || 0,
          };
        }
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
          latitude: 0,
          longitude: 0,
        },
      ];

      const formData = {
        customer_name: customerData.customer_name || customerData.name || "",
        customer_type_code:
          customerData.customer_type_code || customerData.customer_type || "",
        term_code: customerData.term_code || customerData.credit_type || "",
        own_office: customerData.own_office ? "true" : "false",
        assigned_to: customerData.assigned_to_display || "",
        addresses_data: addressData,
      };

      // Set customer form data
      customerForm.setValues({
        customer_name: formData.customer_name,
        customer_type_code: formData.customer_type_code,
        term_code: formData.term_code,
        own_office: formData.own_office,
        assigned_to: formData.assigned_to,
        addresses_data: formData.addresses_data,
      });

      // Set address form data
      addressForm.setValues({
        addresses_data: formData.addresses_data,
      });

      // Initialize selected countries and states for cascading dropdowns
      const newSelectedCountries: Record<number, string> = {};
      const newSelectedStates: Record<number, string> = {};
      const newCustomCities: Record<number, boolean> = {};
      const newCitySearchValues: Record<number, string> = {};

      addressData.forEach((addr: AddressData, idx: number) => {
        if (addr.country) {
          const country = countries.find(
            (c) => c.country_name === addr.country
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
            (c) => c.city_name === addr.city || c.city_code === addr.city
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

  const handleNext = () => {
    // Skip validation in view mode since all fields are readonly
    if (isViewMode) {
      setActive((current) => current + 1);
      return;
    }

    let validationPassed = true;

    if (active === 0) {
      // Validate customer form (Step 1)
      const customerResult = customerForm.validate();
      // console.log("Customer validation result:", customerResult);

      if (customerResult.hasErrors) {
        validationPassed = false;
        // Errors will be displayed inline by the form validation
      }
    }

    if (active === 1) {
      // Validate address form (Step 2)
      const addressResult = addressForm.validate();
      // console.log("Address validation result:", addressResult);

      if (addressResult.hasErrors) {
        validationPassed = false;
        // Force re-render to show validation errors
        addressForm.validate();
      }
    }

    if (validationPassed) {
      setActive((current) => current + 1);
    }
  };

  const handleBack = () => {
    setActive((current) => current - 1);
  };

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
            state.status === "active" && state.country_code === countryCode
        )
        .map((state) => ({
          value: state.id.toString(),
          label: state.state_name,
        }));
    },
    [states]
  );

  // Get state value for a specific address
  const getStateValue = useCallback(
    (index: number) => {
      if (!selectedStates[index]) return "";
      const state = states.find((s) => s.state_name === selectedStates[index]);
      return state ? state.id.toString() : "";
    },
    [selectedStates, states]
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
    [cities]
  );

  // Check if city exists in dropdown options
  const isCityInDropdown = useCallback(
    (cityValue: string) => {
      if (!cityValue) return false;
      const city = cities.find(
        (c) => c.city_name === cityValue || c.city_code === cityValue
      );
      return !!city;
    },
    [cities]
  );

  // Get city name from stored value (code or name)
  const getCityName = useCallback(
    (cityValue: string) => {
      if (!cityValue) return "";
      // Try to find by city_name first
      let city = cities.find((c) => c.city_name === cityValue);
      // If not found, try to find by city_code
      if (!city) {
        city = cities.find((c) => c.city_code === cityValue);
      }
      return city ? city.city_name : cityValue; // Return city name if found, otherwise return the value as-is (custom city)
    },
    [cities]
  );

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
        country.country_code
      );
      customerForm.setFieldValue(`addresses_data.${index}.state`, "");
      customerForm.setFieldValue(`addresses_data.${index}.city`, "");

      addressForm.setFieldValue(
        `addresses_data.${index}.country`,
        country.country_code
      );
      addressForm.setFieldValue(`addresses_data.${index}.state`, "");
      addressForm.setFieldValue(`addresses_data.${index}.city`, "");
    },
    [countries, customerForm, addressForm]
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
        state.state_code
      );

      addressForm.setFieldValue(
        `addresses_data.${index}.state`,
        state.state_code
      );
    },
    [states, customerForm, addressForm]
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
        city.city_name
      );
      addressForm.setFieldValue(`addresses_data.${index}.city`, city.city_name);

      // Clear search value
      setCitySearchValues((prev) => ({ ...prev, [index]: "" }));
    },
    [cities, customerForm, addressForm]
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
    [customerForm, addressForm]
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
            c.city_code.toLowerCase() === searchValue.toLowerCase()
        );
        // Check if any city starts with or contains the search value
        const partialMatch = cities.find(
          (c) =>
            c.city_name.toLowerCase().startsWith(searchValue.toLowerCase()) ||
            c.city_code.toLowerCase().startsWith(searchValue.toLowerCase())
        );
        
        // If no exact or partial match found, switch to custom input
        if (!exactMatch && !partialMatch) {
          setCustomCities((prev) => ({ ...prev, [index]: true }));
          // Also update the form with the custom value
          const formattedValue = toTitleCase(searchValue);
          customerForm.setFieldValue(`addresses_data.${index}.city`, formattedValue);
          addressForm.setFieldValue(`addresses_data.${index}.city`, formattedValue);
        } else if (exactMatch || partialMatch) {
          // If there's a match, ensure we're in dropdown mode
          setCustomCities((prev) => ({ ...prev, [index]: false }));
        }
      } else if (!searchValue) {
        // Clear search value
        setCitySearchValues((prev) => ({ ...prev, [index]: "" }));
      }
    },
    [cities, customerForm, addressForm]
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
    [customerForm, addressForm]
  );

  const createCustomer = async (values: CustomerFormData): Promise<void> => {
    try {
      setIsSubmitting(true);
      const payload = {
        customer_name: values.customer_name,
        customer_type_code: values.customer_type_code,
        term_code: values.term_code,
        own_office: values.own_office === "true",
        assigned_to: values.assigned_to,
        addresses_data: values.addresses_data.map((addr) => ({
          ...addr,
          address_type:
            addr.address_type === "Primary" ? "Primary" : addr.address_type,
        })),
      };

      const res = await postAPICall(URL.customer, payload, API_HEADER);
      if (res) {
        ToastNotification({
          type: "success",
          message: "Customer created successfully",
        });
        navigate("/master/customer", { state: { refreshData: true } });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error while creating customer: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCustomer = async (values: CustomerFormData): Promise<void> => {
    try {
      setIsSubmitting(true);
      const payload = {
        // id: customerData.id,
        // customerData: {
        id: customerData.id,
        customer_name: values.customer_name,
        customer_type_code: values.customer_type_code,
        term_code: values.term_code,
        own_office: values.own_office === "true",
        assigned_to: values.assigned_to,
        addresses_data: values.addresses_data.map((addr) => {
          const addressPayload: any = {
            ...addr,
            address_type:
              addr.address_type === "Primary" ? "Primary" : addr.address_type,
          };

          // Include id if it exists (for existing addresses in edit mode)
          if (addr.id !== undefined && addr.id !== null) {
            addressPayload.id = addr.id;
          }

          return addressPayload;
        }),
        // },
      };

      const res = await putAPICall(URL.customer, payload, API_HEADER);
      if (res) {
        ToastNotification({
          type: "success",
          message: "Customer updated successfully",
        });
        navigate("/master/customer", { state: { refreshData: true } });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error while updating customer: ${errorMessage}`,
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

    if (!customerResult.hasErrors && !addressResult.hasErrors) {
      // Combine data from both forms
      if(customerForm.values.assigned_to === "Agent"){
        customerForm.values.assigned_to = ""
      }
      const finalData = {
        ...customerForm.values,
        addresses_data: addressForm.values.addresses_data,
      };

      if (customerData) {
        updateCustomer(finalData);
      } else {
        createCustomer(finalData);
      }
    } else {
      // Force re-render to show validation errors inline
      if (customerResult.hasErrors) {
        customerForm.validate();
      }
      if (addressResult.hasErrors) {
        addressForm.validate();
      }

      // Show validation errors in console for debugging
      console.log("Customer form errors:", customerResult.errors);
      console.log("Address form errors:", addressResult.errors);
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
              {isCreateMode ? "Creating Customer..." : "Updating Customer..."}
            </Text>
          </Stack>
        </Box>
      )}

      {/* Header */}
      <Text size="xl" fw={600} c="#105476" mb="lg">
        {isCreateMode
          ? "Create Customer"
          : isEditMode
            ? "Edit Customer"
            : "View Customer"}
      </Text>

      <Stepper
        color="#105476"
        active={active}
        onStepClick={setActive}
        orientation="horizontal"
        allowNextStepsSelect={isViewMode}
      >
        {/* Step 1: Customer Master */}
        <Stepper.Step label="1" description="Customer Master">
          <Box mt="md">
            <Card shadow="sm" padding="lg" radius="md">
              <Grid gutter={"sm"}>
                <Grid.Col span={4}>
                  <TextInput
                    label="Customer Name"
                    withAsterisk
                    placeholder="Enter customer name"
                    disabled={!!isViewMode}
                    value={customerForm.values.customer_name}
                    onChange={(e) => {
                      const formattedValue = toTitleCase(e.target.value);
                      customerForm.setFieldValue("customer_name", formattedValue);
                    }}
                    error={customerForm.errors.customer_name}
                  />
                </Grid.Col>

                <Grid.Col span={4}>
                  <Select
                    label="Customer Type"
                    withAsterisk
                    placeholder="Select customer type"
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
              </Grid>

              <Group justify="space-between" mt="xl">
                <Button
                  variant="outline"
                  color="#105476"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => navigate("/master/customer")}
                >
                  Back to Customer List
                </Button>
                <Button
                  rightSection={<IconArrowRight size={14} />}
                  onClick={handleNext}
                  color="#105476"
                  disabled={isSubmitting}
                >
                  Next
                </Button>
              </Group>
            </Card>
          </Box>
        </Stepper.Step>

        {/* Step 2: Address */}
        <Stepper.Step label="2" description="Address">
          <Box mt="md">
            <Card shadow="sm" padding="lg" radius="md">
              <Text size="sm" fw={500}>
                Address
              </Text>

              <Stack>
                {addressForm.values.addresses_data.map((_, index) => (
                  <AddressCard
                    key={`address-${index}-${addressForm.values.addresses_data[index]?.city || ''}-${addressStateRestored}`}
                    index={index}
                    isViewMode={isViewMode}
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
                    getCityName={getCityName}
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
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Group>
                  <Button
                    variant="outline"
                    color="#105476"
                    onClick={() => navigate("/master/customer")}
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

                        if (!customerResult.hasErrors && !addressResult.hasErrors) {
                          // Navigate to customer relationship mapping with customer form data
                          navigate("/master/customer-relationship-mapping/create", {
                            state: {
                              fromCustomerMaster: true,
                              customerFormData: customerForm.values,
                              addressFormData: addressForm.values,
                            },
                          });
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
                      style={{border: "1px solid #105476"}}
                      color="white"
                    >
                      Add Customer Relationships
                    </Button>
                  )}
                  {isEditMode && !isViewMode && customerId && (
                    <Button
                      bg="#105476"
                      onClick={() => {
                        // Validate both forms before navigating to relationship mapping
                        const customerResult = customerForm.validate();
                        const addressResult = addressForm.validate();

                        if (!customerResult.hasErrors && !addressResult.hasErrors) {
                          // Navigate to customer relationship mapping edit with customer_id
                          navigate("/master/customer-relationship-mapping/edit", {
                            state: {
                              customer_id: Number(customerId),
                              fromCustomerMaster: true,
                              customerFormData: customerForm.values,
                              addressFormData: addressForm.values,
                            },
                          });
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
                      style={{border: "1px solid #105476"}}
                      color="white"
                    >
                      Edit Customer Relationships
                    </Button>
                  )}
                  <Button
                    rightSection={<IconCheck size={16} />}
                    onClick={handleFinalSubmit}
                    color="teal"
                    disabled={isViewMode || isSubmitting}
                    loading={isSubmitting}
                    style={{ display: isViewMode ? "none" : "block" }}
                  >
                    {isCreateMode ? "Create" : "Update"}
                  </Button>
                </Group>
              </Group>
            </Card>
          </Box>
        </Stepper.Step>
      </Stepper>
    </Box>
  );
}

export default CustomerCreate;
