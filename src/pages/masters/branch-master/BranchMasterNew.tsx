import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Grid,
  Stack,
  Text,
  TextInput,
  Select,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery } from "@tanstack/react-query";

// Type definitions for API responses
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

type BranchFormData = {
  branch_code: string;
  branch_name: string;
  company_code: string;
  address: string;
  city_id: string | number;
  state_id: string | number;
  country_code: string;
  pin_code: string;
  status: "ACTIVE" | "INACTIVE";
};

function BranchMasterNew() {
  const navigate = useNavigate();
  const [companyOptions, setCompanyOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");

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

  // Fetch states data - filtered by selected country
  const { data: states = [] } = useQuery({
    queryKey: ["states", selectedCountry],
    queryFn: async () => {
      try {
        const url = selectedCountry
          ? `${URL.state}?country_code=${selectedCountry}`
          : URL.state;
        const response = (await getAPICall(
          url,
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
    enabled: !!selectedCountry, // Only fetch when country is selected
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

  // Memoized dropdown options for better performance
  const countryOptions = useMemo(() => {
    return countries.map((country) => ({
      value: country.country_code,
      label: country.country_name,
    }));
  }, [countries]);

  const stateOptions = useMemo(() => {
    return states.map((state) => ({
      value: state.id.toString(),
      label: state.state_name,
    }));
  }, [states]);

  const cityOptions = useMemo(() => {
    return cities.map((city) => ({
      value: city.id.toString(),
      label: city.city_name,
    }));
  }, [cities]);

  // Fetch dropdown
  useEffect(() => {
    const fetchCompanyList = async () => {
      try {
        const res = (await getAPICall(URL.company, API_HEADER)) as Array<{
          company_code: string;
          company_name: string;
        }>;
        const dropdown = res.map((company) => ({
          value: company.company_code,
          label: company.company_name,
        }));
        setCompanyOptions(dropdown);
      } catch (error: unknown) {
        ToastNotification({
          type: "error",
          message: `Error fetching companies: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    };
    fetchCompanyList();
  }, []);

  const schema = yup.object().shape({
    branch_code: yup.string().required("Branch Code is required"),
    branch_name: yup.string().required("Branch Name is required"),
    company_code: yup.string().required("Company is required"),
    address: yup.string().required("Address is required"),
    country_code: yup.string().required("Country is required"),
    state_id: yup.mixed().required("State is required"),
    city_id: yup.mixed().required("City is required"),
    pin_code: yup
      .string()
      .required("Pincode is required")
      .matches(/^\d{6}$/, "Pincode must be 6 digits"),
  });

  const form = useForm<BranchFormData>({
    mode: "uncontrolled",
    initialValues: {
      branch_code: "",
      branch_name: "",
      company_code: "",
      address: "",
      country_code: "",
      state_id: 0,
      city_id: 0,
      pin_code: "",
      status: "ACTIVE", // default status
    },
    validate: yupResolver(schema),
  });

  // Handle country selection to filter states
  const handleCountryChange = (value: string | null) => {
    if (value) {
      setSelectedCountry(value);
      form.setFieldValue("country_code", value);
      // Reset state and city when country changes
      form.setFieldValue("state_id", "");
      form.setFieldValue("city_id", "");
    }
  };

  const branchSubmit = async (values: BranchFormData) => {

    // Prepare payload with correct data types
    const payload = {
      branch_code: values.branch_code,
      branch_name: values.branch_name,
      company_code: values.company_code,
      address: values.address,
      city_id: Number(values.city_id),
      state_id: Number(values.state_id),
      pin_code: values.pin_code,
      country_code: values.country_code,
      status: values.status,
    };

    // console.log("Payload:", payload);

    try {
      await postAPICall(URL.branchMaster, payload, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Branch created successfully",
      });
      navigate("/master/branch");
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: `Error creating branch: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={form.onSubmit(branchSubmit)}
    >
      <Text fw={500} my="md">
        Create Branch
      </Text>

      <Group grow mb="md">
        <TextInput
          label="Branch Code"
          withAsterisk
          {...form.getInputProps("branch_code")}
        />
        <TextInput
          label="Branch Name"
          withAsterisk
          {...form.getInputProps("branch_name")}
        />
      </Group>

      <Grid mb="md">
        <Grid.Col span={6}>
          <Select
            label="Company"
            withAsterisk
            data={companyOptions}
            searchable
            {...form.getInputProps("company_code")}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Address"
            withAsterisk
            {...form.getInputProps("address")}
          />
        </Grid.Col>
      </Grid>

      <Grid mb="md">
        <Grid.Col span={4}>
          <Select
            label="Country"
            withAsterisk
            data={countryOptions}
            searchable
            value={selectedCountry}
            onChange={handleCountryChange}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <Select
            label="State"
            withAsterisk
            data={stateOptions}
            searchable
            disabled={!selectedCountry}
            {...form.getInputProps("state_id")}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <Select
            label="City"
            withAsterisk
            data={cityOptions}
            searchable
            {...form.getInputProps("city_id")}
          />
        </Grid.Col>
      </Grid>

      <Grid mb="md">
        <Grid.Col span={4}>
          <TextInput
            label="Pincode"
            withAsterisk
            {...form.getInputProps("pin_code")}
          />
        </Grid.Col>
      </Grid>

      <Stack justify="space-between" mt="20%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/branch")}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
          >
            Back
          </Button>
          <Flex gap="md">
            <Button
              variant="outline"
              onClick={() => navigate("/master/branch")}
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="#105476"
              rightSection={<IconCheck size={16} />}
            >
              Submit
            </Button>
          </Flex>
        </Flex>
      </Stack>
    </Box>
  );
}

export default BranchMasterNew;
