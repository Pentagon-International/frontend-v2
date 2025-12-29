import {
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
  Loader,
  Center,
  Select,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useState, useEffect, useCallback } from "react";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { postAPICall } from "../../service/postApiCall";
import { ToastNotification, SearchableSelect } from "../../components";

type PipelineFormData = {
  customer: string;
};

type CustomerProfilingData = {
  id: number;
  customer_code: string;
  customer_name: string;
  service: string;
  origin_port_code: string;
  origin_port_name: string;
  destination_port_code: string;
  destination_port_name: string;
  no_of_shipments: number;
  frequency_id: number;
  frequency_name: string;
  volume: string;
  potential_profit: string;
};

type ProfilingFormData = {
  profiles: Array<{
    profile_id?: number;
    service: string;
    service_code: string;
    origin_name: string;
    origin_code: string;
    destination_name: string;
    destination_code: string;
    no_of_shipments: string;
    frequency_name: string;
    frequency_id: string;
    volume: string;
    profit: string;
    pipeline_shipments: string;
    pipeline_volume: string;
    pipeline_profit: string;
  }>;
  newProfiles: Array<{
    service: string;
    service_code: string;
    origin_name: string;
    origin_code: string;
    destination_name: string;
    destination_code: string;
    no_of_shipments: string;
    frequency_name: string;
    frequency_id: string;
    volume: string;
    profit: string;
    pipeline_shipments: string;
    pipeline_volume: string;
    pipeline_profit: string;
  }>;
};

function PipelineCreate() {
  const [customerProfilingData, setCustomerProfilingData] = useState<
    CustomerProfilingData[]
  >([]);
  const [isLoadingProfiling, setIsLoadingProfiling] = useState(false);
  const [selectedCustomerCode, setSelectedCustomerCode] = useState<string>("");
  const [frequencyOptions, setFrequencyOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const navigate = useNavigate();
  const routerLocation = useLocation();

  // States for edit mode and view mode
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [customerOption, setCustomerOption] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFrequencyOptions = async () => {
    try {
      const frequencyData = await getAPICall(`${URL.frequency}`, API_HEADER);
      const options = (frequencyData as any[]).map((item: any) => ({
        value: String(item.id),
        label: item.frequency_name,
      }));
      setFrequencyOptions(options);
    } catch (error) {
      console.error("Error fetching frequency options:", error);
    }
  };

  const fetchCustomerProfiling = async (customerCode: string) => {
    if (!customerCode) return;

    setIsLoadingProfiling(true);
    try {
      const response = await getAPICall(
        `${URL.profiling}?customer_code=${customerCode}`,
        API_HEADER
      );
      setCustomerProfilingData(response as CustomerProfilingData[]);

      // Auto-fill will be handled by useEffect when dropdown options are loaded
    } catch (error) {
      console.error("Error fetching customer profiling data:", error);
      ToastNotification({
        type: "error",
        message: "Failed to fetch customer profiling data",
      });
    } finally {
      setIsLoadingProfiling(false);
    }
  };

  // Validation schema for profiling form
  const profilingSchema = yup.object().shape({
    profiles: yup.array().of(
      yup.object().shape({
        service: yup
        .string()
        .strict(true)
        .required("Service is required")
        .test("not-empty", "Service is required", (value) =>
          typeof value === "string" && value.trim() !== ""
        ),
        origin_code: yup
          .string()
          .required("Origin is required")
          .test("not-empty", "Origin is required", function (value) {
            return value !== undefined && value !== null && value.trim() !== "";
          }),
        destination_code: yup
          .string()
          .required("Destination is required")
          .test("not-empty", "Destination is required", function (value) {
            return value !== undefined && value !== null && value.trim() !== "";
          }),
        frequency_id: yup
          .string()
          .required("Frequency is required")
          .test("not-empty", "Frequency is required", function (value) {
            return value !== undefined && value !== null && value.trim() !== "";
          }),
        volume: yup
          .string()
          .matches(
            /^(\d+(\.\d{1,3})?)?$/,
            "Up to 3 decimal places allowed"
          ),
        pipeline_volume: yup
          .string()
          .matches(
            /^(\d+(\.\d{1,3})?)?$/,
            "Up to 3 decimal places allowed"
          ),
          no_of_shipments: yup
  .string()
  .test(
    "is-integer",
    "Shipments must be a whole number",
    (value) => !value || /^\d+$/.test(value)
  ),
  pipeline_shipments: yup
  .string()
  .test(
    "is-integer",
    "Shipments must be a whole number",
    (value) => !value || /^\d+$/.test(value)
  ),
  profit: yup
  .string()
  .matches(/^(\d+(\.\d{1,2})?)?$/, "Up to 2 decimal places allowed"),
  pipeline_profit: yup
  .string()
  .matches(/^(\d+(\.\d{1,2})?)?$/, "Up to 2 decimal places allowed"),
      }),
      
    ),
    newProfiles: yup.array().of(
      yup.object().shape({
        service: yup
        .string()
        .strict(true)
        .required("Service is required")
        .test("not-empty", "Service is required", (value) =>
          typeof value === "string" && value.trim() !== ""
        ),
        origin_code: yup
          .string()
          .required("Origin is required")
          .test("not-empty", "Origin is required", function (value) {
            return value !== undefined && value !== null && value.trim() !== "";
          }),
        destination_code: yup
          .string()
          .required("Destination is required")
          .test("not-empty", "Destination is required", function (value) {
            return value !== undefined && value !== null && value.trim() !== "";
          }),
        frequency_id: yup
          .string()
          .required("Frequency is required")
          .test("not-empty", "Frequency is required", function (value) {
            return value !== undefined && value !== null && value.trim() !== "";
          }),
        volume: yup
          .string()
          .matches(
            /^(\d+(\.\d{1,3})?)?$/,
            "Up to 3 decimal places allowed"
          ),
        pipeline_volume: yup
          .string()
          .matches(
            /^(\d+(\.\d{1,3})?)?$/,
            "Up to 3 decimal places allowed"
          ),
          no_of_shipments: yup
          .string()
          .test(
            "is-integer",
            "Shipments must be a whole number",
            (value) => !value || /^\d+$/.test(value)
          ),
          pipeline_shipments: yup
          .string()
          .test(
            "is-integer",
            "Shipments must be a whole number",
            (value) => !value || /^\d+$/.test(value)
          ),
          pipeline_profit: yup
  .string()
  .matches(/^(\d+(\.\d{1,2})?)?$/, "Up to 2 decimal places allowed"),
  profit: yup
  .string()
  .matches(/^(\d+(\.\d{1,2})?)?$/, "Up to 2 decimal places allowed"),
              }),
              
    
    ),
  });


  const pipelineForm = useForm({
    mode: "controlled",
    initialValues: {
      customer: "",
    },
     validate: yupResolver(profilingSchema), // Validation commented out
  });

  const profilingForm = useForm<ProfilingFormData>({
    mode: "controlled",
    initialValues: {
      profiles: [],
      newProfiles: [],
    },
    validate: yupResolver(profilingSchema),
  });

  const autoFillFormWithProfilingData = useCallback(
    (profilingData: CustomerProfilingData[]) => {
      if (!profilingData || profilingData.length === 0) return;

      const initialProfiles = profilingData.map(
        (item: CustomerProfilingData) => {
          return {
            service: item.service,
            service_code: "", // Will be populated from API response if available
            origin_name: item.origin_port_name,
            origin_code: item.origin_port_code, // Populated from API response
            destination_name: item.destination_port_name,
            destination_code: item.destination_port_code, // Populated from API response
            no_of_shipments: String(item.no_of_shipments || ""),
            frequency_name: item.frequency_name || "",
            frequency_id: String(item.frequency_id || ""),
            volume: item.volume || "",
            profit: item.potential_profit || "",
            pipeline_shipments: "",
            pipeline_volume: "",
            pipeline_profit: "",
          };
        }
      );

      profilingForm.setValues({
        profiles: initialProfiles,
      });
    },
    [profilingForm]
  );

  // Auto-fill form when customer profiling data is first loaded
  useEffect(() => {
    if (
      customerProfilingData.length > 0 &&
      profilingForm.values.profiles.length === 0
    ) {
      autoFillFormWithProfilingData(customerProfilingData);
    }
  }, [
    customerProfilingData,
    autoFillFormWithProfilingData,
    profilingForm.values.profiles.length,
  ]);

  // Load frequency options on component mount
  useEffect(() => {
    fetchFrequencyOptions();
  }, []);

  useEffect(() => {
    if (routerLocation.state) {
      const actionType = routerLocation.state.actionType;

      if (actionType === "edit") {
        setEditMode(true);
        setViewMode(false);
      } else if (actionType === "view") {
        setViewMode(true);
        setEditMode(false);
      }

      // Set customer with code and name directly (for both edit and view)
      if (
        routerLocation.state.customer_code &&
        routerLocation.state.customer_name
      ) {
        const customerObj = {
          value: String(routerLocation.state.customer_code ?? ""),
          label: String(routerLocation.state.customer_name ?? ""),
        };
        pipelineForm.setFieldValue("customer", customerObj.value);
        setSelectedCustomerCode(customerObj.value);
        setCustomerOption(customerObj);
      }
      // Handle pipelines array from the new response format
      const pipelines = routerLocation.state.pipelines || [];
      const mappedProfiles = pipelines.map((row: any) => ({
        profile_id: row.profile_id ?? null,
        service: row.service || "",
        service_code: "",
        origin_name: row.origin_port_name || "",
        origin_code: row.origin_port_code || "",
        destination_name: row.destination_port_name || "",
        destination_code: row.destination_port_code || "",
        frequency_name: row.frequency_name || "",
        frequency_id: String(row.frequency_id ?? ""),
        pipeline_shipments: String(row.no_of_shipments ?? ""),
        pipeline_volume:
          row.volume !== undefined && row.volume !== null
            ? String(row.volume)
            : "",
        pipeline_profit:
          row.profit !== undefined && row.profit !== null
            ? String(row.profit)
            : "",
        no_of_shipments: String(
          row.profile_no_of_shipments ?? row.no_of_shipments ?? ""
        ),
        volume:
          row.profile_volume !== undefined && row.profile_volume !== null
            ? String(row.profile_volume)
            : row.volume || "",
        profit:
          row.profile_profit !== undefined && row.profile_profit !== null
            ? String(row.profile_profit)
            : row.profit || "",
      }));
      profilingForm.setValues({
        profiles: mappedProfiles,
        newProfiles: [],
      });
      setCustomerProfilingData([]);
    }
  }, [routerLocation.state]);

  const handleAddNewProfile = () => {
    profilingForm.insertListItem("newProfiles", {
      service: "",
      service_code: "",
      origin_name: "",
      origin_code: "",
      destination_name: "",
      destination_code: "",
      no_of_shipments: "",
      frequency_name: "",
      frequency_id: "",
      volume: "",
      profit: "",
      pipeline_shipments: "",
      pipeline_volume: "",
      pipeline_profit: "",
    });
  };

  const handleRemoveNewProfile = (index: number) => {
    profilingForm.removeListItem("newProfiles", index);
  };

  const handleCreateForm = async (values: PipelineFormData): Promise<void> => {
    setIsSubmitting(true);
    // Validate profiling form before submission
    const profilingValidationResult = profilingForm.validate();
    if (profilingValidationResult.hasErrors) {
      setIsSubmitting(false);
      ToastNotification({
        type: "error",
        message: "Please fix validation errors before submitting",
      });
      return;
    }

    try {
      console.log("-------------profile-----", profilingForm.values.profiles);
      const existingPipelineItems = profilingForm.values.profiles.map(
        (profile) => ({
          profile_id: profile.profile_id ?? null,
          service: profile.service,
          origin: profile.origin_code,
          destination: profile.destination_code,
          no_of_shipments: parseInt(profile.pipeline_shipments) || 0,
          frequency: parseInt(profile.frequency_id) || 0,
          volume: parseInt(profile.pipeline_volume) || 0,
          profit: parseInt(profile.pipeline_profit) || 0,
          profile_no_of_shipments: parseInt(profile.no_of_shipments) || 0,
          profile_volume: parseInt(profile.volume) || 0,
          profile_profit: parseInt(profile.profit) || 0,
        })
      );
      if (editMode && routerLocation.state && routerLocation.state.pipelines) {
        // Inline import for putAPICall
        const { putAPICall } = await import("../../service/putApiCall");

        // PUT each existing profile item as a flat payload (no pipeline_items)
        // Map each profile to its corresponding pipeline id
        const pipelines = routerLocation.state.pipelines || [];
        for (let i = 0; i < existingPipelineItems.length; i++) {
          const item = existingPipelineItems[i];
          const pipeline = pipelines[i];
          console.log("-----------------pipeline", item);
          if (pipeline && pipeline.id) {
            const putPayload = {
              id: pipeline.id,
              customer_code: values.customer,
              service: item.service,
              origin: item.origin,
              destination: item.destination,
              no_of_shipments: item.no_of_shipments,
              frequency: item.frequency,
              volume: item.volume,
              profit: item.profit,
              profile_id: item.profile_id ?? null,
              profile_no_of_shipments: item.profile_no_of_shipments ?? null,
              profile_volume: item.profile_volume ?? null,
              profile_profit: item.profile_profit ?? null,
            };
            await putAPICall(URL.pipeline, putPayload, API_HEADER);
          }
        }

        // Handle any new profiles in edit mode (same as create flow)
        if (profilingForm.values.newProfiles.length > 0) {
          // POST to profiling per new profile
          for (const newProfile of profilingForm.values.newProfiles) {
            const profilingPayload = {
              customer_code: values.customer,
              service: newProfile.service,
              origin: newProfile.origin_code,
              destination: newProfile.destination_code,
              no_of_shipments: parseInt(newProfile.no_of_shipments) || 0,
              frequency: parseInt(newProfile.frequency_id) || 0,
              volume: newProfile.volume,
              potential_profit: parseInt(newProfile.profit) || 0,
            };
            await postAPICall(URL.profiling, profilingPayload, API_HEADER);
          }

          // POST once to pipeline with new pipeline_items
          const newPipelineItems = profilingForm.values.newProfiles.map(
            (newProfile) => ({
              service: newProfile.service,
              origin: newProfile.origin_code,
              destination: newProfile.destination_code,
              no_of_shipments: parseInt(newProfile.pipeline_shipments) || 0,
              frequency: parseInt(newProfile.frequency_id) || 0,
              volume: parseInt(newProfile.pipeline_volume) || 0,
              profit: parseInt(newProfile.pipeline_profit) || 0,
            })
          );

          if (newPipelineItems.length > 0) {
            const newPipelinePayload = {
              customer_code: values.customer,
              pipeline_items: newPipelineItems,
            };
            await postAPICall(URL.pipeline, newPipelinePayload, API_HEADER);
          }
        }

        ToastNotification({
          type: "success",
          message: "Pipeline entry updated successfully",
        });
        setIsSubmitting(false);
        const returnTo =
          (routerLocation.state as { returnTo?: string })?.returnTo ||
          "/pipeline";
        navigate(returnTo, {
          state: { refreshData: true, timestamp: Date.now() },
        });
        return;
      }

      // Transform new profiling data to pipeline format (for future use if needed)
      // const newPipelineItems = profilingForm.values.newProfiles.map((profile) => ({
      //   service: profile.service,
      //   origin: profile.origin_code,
      //   destination: profile.destination_code,
      //   no_of_shipments: parseInt(profile.pipeline_shipments) || 0,
      //   frequency: parseInt(profile.frequency_id) || 0,
      //   volume: parseInt(profile.pipeline_volume) || 0,
      //   profit: parseInt(profile.pipeline_profit) || 0,
      // }));

      // Aggregate both arrays (for future use if needed)
      // const allPipelineItems = [...existingPipelineItems, ...newPipelineItems];

      // Submit existing profile data to pipeline API
      if (existingPipelineItems.length > 0) {
        const existingPayload = {
          customer_code: values.customer,
          pipeline_items: existingPipelineItems,
        };

        await postAPICall(URL.pipeline, existingPayload, API_HEADER);
      }

      // Submit new profile data to customer profiling API first (hit each time for each profile)
      if (profilingForm.values.newProfiles.length > 0) {
        // Hit profiling API for each new profile (single object each time)
        for (const newProfile of profilingForm.values.newProfiles) {
          const profilingPayload = {
            customer_code: values.customer,
            service: newProfile.service,
            origin: newProfile.origin_code,
            destination: newProfile.destination_code,
            no_of_shipments: parseInt(newProfile.no_of_shipments) || 0,
            frequency: parseInt(newProfile.frequency_id) || 0,
            volume: newProfile.volume,
            potential_profit: parseInt(newProfile.profit) || 0,
          };

          await postAPICall(URL.profiling, profilingPayload, API_HEADER);
        }

        // After all profiling API calls success, hit the pipeline API with array of objects (single hit)
        const newPipelineItems = profilingForm.values.newProfiles.map(
          (newProfile) => ({
            service: newProfile.service,
            origin: newProfile.origin_code,
            destination: newProfile.destination_code,
            no_of_shipments: parseInt(newProfile.pipeline_shipments) || 0,
            frequency: parseInt(newProfile.frequency_id) || 0,
            volume: parseInt(newProfile.pipeline_volume) || 0,
            profit: parseInt(newProfile.pipeline_profit) || 0,
          })
        );

        const newPipelinePayload = {
          customer_code: values.customer,
          pipeline_items: newPipelineItems,
        };

        await postAPICall(URL.pipeline, newPipelinePayload, API_HEADER);
      }

      // If no existing data and no new profiles, show error
      if (
        existingPipelineItems.length === 0 &&
        profilingForm.values.newProfiles.length === 0
      ) {
        ToastNotification({
          type: "error",
          message: "Please add at least one profile entry",
        });
        return;
      }

      ToastNotification({
        type: "success",
        message: "Pipeline entry created successfully",
      });
      setIsSubmitting(false);

      const returnTo =
        (routerLocation.state as { returnTo?: string })?.returnTo ||
        "/pipeline";
      navigate(returnTo, {
        state: {
          refreshData: true,
          timestamp: Date.now(),
        },
      });
    } catch (err: unknown) {
      ToastNotification({
        type: "error",
        message: `Error while creating${editMode ? "/updating" : ""} pipeline entry: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      style={{ padding: "0 1%", position: "relative" }}
      onSubmit={
        viewMode
          ? (e) => e.preventDefault()
          : pipelineForm.onSubmit(handleCreateForm)
      }
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

      <Flex justify={"space-between"} align="center">
        <Text fw={500} my="md">
          {viewMode
            ? "Pipeline Entry Details (View Only)"
            : "Pipeline Entry Details"}
        </Text>
      </Flex>

      {/* Customer Selection */}
      <Group mb={"md"}>
        <Box maw={400}>
          <SearchableSelect
            label="Customer Name"
            placeholder="Type customer name"
            apiEndpoint={editMode ? undefined : URL.customer}
            searchFields={editMode ? [] : ["customer_name", "customer_code"]}
            displayFormat={(item: Record<string, unknown>) => ({
              value: String(item.customer_code),
              label: String(item.customer_name),
            })}
            value={pipelineForm.values.customer}
            displayValue={
              customerOption && typeof customerOption.label === "string"
                ? customerOption.label
                : undefined
            }
            onChange={(value, selectedData) => {
              const fixedVal = value ? String(value) : "";
              pipelineForm.setFieldValue("customer", fixedVal);
              setSelectedCustomerCode(fixedVal);
              if (selectedData && typeof selectedData.label === "string") {
                setCustomerOption({
                  value: fixedVal,
                  label: String(selectedData.label),
                });
              } else {
                setCustomerOption(null);
              }
              if (!editMode && value) {
                fetchCustomerProfiling(fixedVal);
              } else if (!editMode && !value) {
                setCustomerProfilingData([]);
                profilingForm.setValues({ profiles: [] });
              }
            }}
            minSearchLength={2}
            required
            disabled={editMode || viewMode}
          />
        </Box>
      </Group>

      {/* Loading State */}
      {isLoadingProfiling && (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">Loading data...</Text>
          </Stack>
        </Center>
      )}

      {/* Profile Data Grid */}
      {selectedCustomerCode && !isLoadingProfiling && (
        <Box mb="md">
          {/* Table Headers - First Row */}
          <Grid
            style={{
              backgroundColor: "#f8f9fa",
              padding: "8px 12px",
              borderRadius: "4px",
              borderBottom: "1px solid #dee2e6",
              fontWeight: 600,
              fontSize: "12px",
            }}
          >
            {/* Profile Section Headers */}
            <Grid.Col span={1}></Grid.Col>
            <Grid.Col span={1.5}></Grid.Col>
            <Grid.Col span={1.5}></Grid.Col>
            <Grid.Col span={1.5}></Grid.Col>
            {/* Profile Section Header - spans over Shipments, Volume, Profit */}
            <Grid.Col
              span={3.1}
              style={{
                borderBottom: "2px solid #105476",
                paddingBottom: "4px",
                borderRight: "none",
              }}
            >
              <Text fw={600} c="#105476" size="sm" ta="center">
                Profile
              </Text>
            </Grid.Col>
            {/* Gap column to separate underlines */}
            <Grid.Col span={0.2} style={{ borderBottom: "none" }}></Grid.Col>
            {/* Pipeline Section Header - spans over Shipments, Volume, Profit */}
            <Grid.Col
              span={2.8}
              style={{
                borderBottom: "2px solid #105476",
                paddingBottom: "4px",
                borderLeft: "none",
              }}
            >
              <Text fw={600} c="#105476" size="sm" ta="center">
                Pipeline
              </Text>
            </Grid.Col>
          </Grid>

          {/* Sub Headers Row - Second Row */}
          <Grid
            style={{
              backgroundColor: "#f8f9fa",
              padding: "8px 12px",
              borderBottom: "1px solid #dee2e6",
              fontWeight: 600,
              fontSize: "12px",
            }}
          >
            <Grid.Col span={1} style={{ borderBottom: "none" }}>
              Service
            </Grid.Col>
            <Grid.Col span={1.5} style={{ borderBottom: "none" }}>
              Origin
            </Grid.Col>
            <Grid.Col span={1.5} style={{ borderBottom: "none" }}>
              Destination
            </Grid.Col>
            <Grid.Col span={1.5} style={{ borderBottom: "none" }}>
              Frequency
            </Grid.Col>
            {/* Profile Sub Headers */}
            <Grid.Col span={1.1}>Shipments</Grid.Col>
            <Grid.Col span={1}>Volume</Grid.Col>
            <Grid.Col span={1}>Profit</Grid.Col>
            {/* Gap column to separate sections */}
            <Grid.Col span={0.2} style={{ borderBottom: "none" }}></Grid.Col>
            {/* Pipeline Sub Headers */}
            <Grid.Col span={1}>Shipments</Grid.Col>
            <Grid.Col span={1}>Volume</Grid.Col>
            <Grid.Col span={1}>Profit</Grid.Col>
          </Grid>

          {/* Existing Profile Data */}
          {profilingForm.values.profiles.map((_, index) => (
            <Box key={`existing-${index}`} mt="sm">
              <Grid>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Service"
                    value={profilingForm.values.profiles[index]?.service || ""}
                    readOnly
                    styles={{
                      input: {
                        backgroundColor: "#f8f9fa",
                        cursor: "not-allowed",
                      },
                    }}
                    // size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <SearchableSelect
                    placeholder="Origin"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_name", "port_code"]}
                    displayFormat={(item: any) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={
                      profilingForm.values.profiles[index]?.origin_code || ""
                    }
                    displayValue={
                      profilingForm.values.profiles[index]?.origin_name || ""
                    }
                    onChange={(value, selectedData) => {
                      profilingForm.setFieldValue(
                        `profiles.${index}.origin_code`,
                        value || ""
                      );
                      if (selectedData) {
                        profilingForm.setFieldValue(
                          `profiles.${index}.origin_name`,
                          selectedData.label || ""
                        );
                      } else if (!value || value === "") {
                        // Clear the label when value is cleared
                        profilingForm.setFieldValue(
                          `profiles.${index}.origin_name`,
                          ""
                        );
                      }
                      // Clear validation error when field is changed
                      profilingForm.clearFieldError(
                        `profiles.${index}.origin_code`
                      );
                    }}
                    minSearchLength={2}
                    disabled
                    required
                    error={
                      profilingForm.errors[
                        `profiles.${index}.origin_code`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <SearchableSelect
                    placeholder="Destination"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_name", "port_code"]}
                    displayFormat={(item: any) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={
                      profilingForm.values.profiles[index]?.destination_code ||
                      ""
                    }
                    displayValue={
                      profilingForm.values.profiles[index]?.destination_name ||
                      ""
                    }
                    onChange={(value, selectedData) => {
                      profilingForm.setFieldValue(
                        `profiles.${index}.destination_code`,
                        value || ""
                      );
                      if (selectedData) {
                        profilingForm.setFieldValue(
                          `profiles.${index}.destination_name`,
                          selectedData.label || ""
                        );
                      } else if (!value || value === "") {
                        // Clear the label when value is cleared
                        profilingForm.setFieldValue(
                          `profiles.${index}.destination_name`,
                          ""
                        );
                      }
                      // Clear validation error when field is changed
                      profilingForm.clearFieldError(
                        `profiles.${index}.destination_code`
                      );
                    }}
                    minSearchLength={2}
                    disabled
                    required
                    error={
                      profilingForm.errors[
                        `profiles.${index}.destination_code`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <Select
                    placeholder="Frequency"
                    data={frequencyOptions}
                    value={
                      profilingForm.values.profiles[index]?.frequency_id || ""
                    }
                    onChange={(value) => {
                      profilingForm.setFieldValue(
                        `profiles.${index}.frequency_id`,
                        value || ""
                      );
                      const selectedFrequency = frequencyOptions.find(
                        (opt) => opt.value === value
                      );
                      profilingForm.setFieldValue(
                        `profiles.${index}.frequency_name`,
                        selectedFrequency?.label || ""
                      );
                      // Clear validation error when field is changed
                      profilingForm.clearFieldError(
                        `profiles.${index}.frequency_id`
                      );
                    }}
                    disabled
                    required
                    error={
                      profilingForm.errors[
                        `profiles.${index}.frequency_id`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Shipments"
                    type="number"
                    min={0}
                    value={
                      profilingForm.values.profiles[index]?.no_of_shipments ||
                      ""
                    }
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `profiles.${index}.no_of_shipments`,
                        e.currentTarget.value
                      )
                    }
                    onInput={e => {
                      const target = e.target as HTMLInputElement;
                      // Remove anything that's not a digit
                      target.value = target.value.replace(/[^0-9]/g, '');
                    }}
                    error={
                      profilingForm.errors[
                        `profiles.${index}.no_of_shipments`
                      ] as string
                    }
                    disabled={viewMode}
                    readOnly={viewMode}
                    styles={
                      viewMode
                        ? {
                            input: {
                              backgroundColor: "#f8f9fa",
                              cursor: "not-allowed",
                            },
                          }
                        : undefined
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Volume"
                    type="number"
                    value={profilingForm.values.profiles[index]?.volume || ""}
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `profiles.${index}.volume`,
                        e.currentTarget.value
                      )
                    }
                    error={
                      profilingForm.errors[
                        `profiles.${index}.volume`
                      ] as string
                    }
                    disabled={viewMode}
                    readOnly={viewMode}
                    styles={
                      viewMode
                        ? {
                            input: {
                              backgroundColor: "#f8f9fa",
                              cursor: "not-allowed",
                            },
                          }
                        : undefined
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Profit"
                    type="number"
                    value={profilingForm.values.profiles[index]?.profit || ""}
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `profiles.${index}.profit`,
                        e.currentTarget.value
                      )
                    }
                    // onInput={e => {
                    //   const target = e.target as HTMLInputElement;
                    //   target.value = target.value.replace(/^(\d+)(\.\d{0,2})?.*$/, (_, int, dec) => int + (dec ?? ''));
                    // }}
                    error={
                      profilingForm.errors[
                        `profiles.${index}.profit`
                      ] as string
                    }
                    disabled={viewMode}
                    readOnly={viewMode}
                    styles={
                      viewMode
                        ? {
                            input: {
                              backgroundColor: "#f8f9fa",
                              cursor: "not-allowed",
                            },
                          }
                        : undefined
                    }
                  />
                </Grid.Col>
                {/* Gap column to separate sections */}
                <Grid.Col span={0.2}></Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Pipeline Shipments"
                    type="number"
                    min={0}
                    value={
                      profilingForm.values.profiles[index]
                        ?.pipeline_shipments || ""
                    }
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `profiles.${index}.pipeline_shipments`,
                        e.currentTarget.value
                      )
                    }
                    onInput={e => {
                      const target = e.target as HTMLInputElement;
                      // Remove anything that's not a digit
                      target.value = target.value.replace(/[^0-9]/g, '');
                    }}
                    error={
                      profilingForm.errors[
                        `profiles.${index}.pipeline_shipments`
                      ] as string
                    }
                    disabled={viewMode}
                    readOnly={viewMode}
                    styles={
                      viewMode
                        ? {
                            input: {
                              backgroundColor: "#f8f9fa",
                              cursor: "not-allowed",
                            },
                          }
                        : undefined
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Pipeline Volume"
                    type="number"
                  
                    value={
                      profilingForm.values.profiles[index]?.pipeline_volume ||
                      ""
                    }
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `profiles.${index}.pipeline_volume`,
                        e.currentTarget.value
                      )
                    }
                    error={
                      profilingForm.errors[
                        `profiles.${index}.pipeline_volume`
                      ] as string
                    }
                    disabled={viewMode}
                    readOnly={viewMode}
                    styles={
                      viewMode
                        ? {
                            input: {
                              backgroundColor: "#f8f9fa",
                              cursor: "not-allowed",
                            },
                          }
                        : undefined
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Pipeline Profit"
                    type="number"
                    value={
                      profilingForm.values.profiles[index]?.pipeline_profit ||
                      ""
                    }
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `profiles.${index}.pipeline_profit`,
                        e.currentTarget.value
                      )
                    }
                    error={
                      profilingForm.errors[
                        `profiles.${index}.pipeline_profit`
                      ] as string
                    }
                    disabled={viewMode}
                    readOnly={viewMode}
                    styles={
                      viewMode
                        ? {
                            input: {
                              backgroundColor: "#f8f9fa",
                              cursor: "not-allowed",
                            },
                          }
                        : undefined
                    }
                  />
                </Grid.Col>
              </Grid>
            </Box>
          ))}

          {/* New Profile Data */}
          {profilingForm.values.newProfiles.map((_, index) => (
            <Box key={`new-${index}`} mt="sm">
              <Grid>
                <Grid.Col span={1}>
                  <Select
                    placeholder="Service"
                    data={["AIR", "FCL", "LCL"]}
                    value={
                      profilingForm.values.newProfiles[index]?.service || ""
                    }
                    onChange={(value) =>
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.service`,
                        value && value.trim() ? value : undefined
                      )
                    }
                    clearable
                    required
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.service`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <SearchableSelect
                    placeholder="Origin"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_name", "port_code"]}
                    displayFormat={(item: any) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={
                      profilingForm.values.newProfiles[index]?.origin_code || ""
                    }
                    displayValue={
                      profilingForm.values.newProfiles[index]?.origin_name || ""
                    }
                    onChange={(value, selectedData) => {
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.origin_code`,
                        value || ""
                      );
                      if (selectedData) {
                        profilingForm.setFieldValue(
                          `newProfiles.${index}.origin_name`,
                          selectedData.label || ""
                        );
                      } else if (!value || value === "") {
                        // Clear the label when value is cleared
                        profilingForm.setFieldValue(
                          `newProfiles.${index}.origin_name`,
                          ""
                        );
                      }
                      // Clear validation error when field is changed
                      profilingForm.clearFieldError(
                        `newProfiles.${index}.origin_code`
                      );
                    }}
                    minSearchLength={2}
                    required
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.origin_code`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <SearchableSelect
                    placeholder="Destination"
                    apiEndpoint={URL.portMaster}
                    searchFields={["port_name", "port_code"]}
                    displayFormat={(item: any) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={
                      profilingForm.values.newProfiles[index]
                        ?.destination_code || ""
                    }
                    displayValue={
                      profilingForm.values.newProfiles[index]
                        ?.destination_name || ""
                    }
                    onChange={(value, selectedData) => {
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.destination_code`,
                        value || ""
                      );
                      if (selectedData) {
                        profilingForm.setFieldValue(
                          `newProfiles.${index}.destination_name`,
                          selectedData.label || ""
                        );
                      } else if (!value || value === "") {
                        // Clear the label when value is cleared
                        profilingForm.setFieldValue(
                          `newProfiles.${index}.destination_name`,
                          ""
                        );
                      }
                      // Clear validation error when field is changed
                      profilingForm.clearFieldError(
                        `newProfiles.${index}.destination_code`
                      );
                    }}
                    minSearchLength={2}
                    required
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.destination_code`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1.5}>
                  <Select
                    placeholder="Frequency"
                    data={frequencyOptions}
                    value={
                      profilingForm.values.newProfiles[index]?.frequency_id ||
                      ""
                    }
                    onChange={(value) => {
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.frequency_id`,
                        value || ""
                      );
                      const selectedFrequency = frequencyOptions.find(
                        (opt) => opt.value === value
                      );
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.frequency_name`,
                        selectedFrequency?.label || ""
                      );
                      // Clear validation error when field is changed
                      profilingForm.clearFieldError(
                        `newProfiles.${index}.frequency_id`
                      );
                    }}
                    required
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.frequency_id`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Shipments"
                    type="number"
                    min={0}
                    value={
                      profilingForm.values.newProfiles[index]
                        ?.no_of_shipments || ""
                    }
                    onInput={e => {
                      const target = e.target as HTMLInputElement;
                      // Remove anything that's not a digit
                      target.value = target.value.replace(/[^0-9]/g, '');
                    }}
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.no_of_shipments`,
                        e.currentTarget.value
                      )
                    }
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.no_of_shipments`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Volume"
                    type="number"
                    value={
                      profilingForm.values.newProfiles[index]?.volume || ""
                    }
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.volume`
                      ] as string
                    }
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.volume`,
                        e.currentTarget.value
                      )
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Profit"
                    type="number"
                    value={
                      profilingForm.values.newProfiles[index]?.profit || ""
                    }
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.profit`,
                        e.currentTarget.value
                      )
                    }
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.profit`
                      ] as string
                    }
                  />
                </Grid.Col>
                {/* Gap column to separate sections */}
                <Grid.Col span={0.2}></Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Pipeline"
                    type="number"
                    min={0}
                    value={
                      profilingForm.values.newProfiles[index]
                        ?.pipeline_shipments || ""
                    }
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.pipeline_shipments`
                      ] as string
                    }
                    onInput={e => {
                      const target = e.target as HTMLInputElement;
                      // Remove anything that's not a digit
                      target.value = target.value.replace(/[^0-9]/g, '');
                    }}
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.pipeline_shipments`,
                        e.currentTarget.value
                      )
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Volume"
                    type="number"
                    value={
                      profilingForm.values.newProfiles[index]
                        ?.pipeline_volume || ""
                    }
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.pipeline_volume`,
                        e.currentTarget.value
                      )
                    }
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.pipeline_volume`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={1}>
                  <TextInput
                    placeholder="Profit"
                    type="number"
                    value={
                      profilingForm.values.newProfiles[index]
                        ?.pipeline_profit || ""
                    }
                    onChange={(e) =>
                      profilingForm.setFieldValue(
                        `newProfiles.${index}.pipeline_profit`,
                        e.currentTarget.value
                      )
                    }
                    error={
                      profilingForm.errors[
                        `newProfiles.${index}.pipeline_profit`
                      ] as string
                    }
                  />
                </Grid.Col>
                <Grid.Col span={0.4}>
                  <Button
                    variant="light"
                    color="red"
                    onClick={() => handleRemoveNewProfile(index)}
                  >
                    <IconTrash size={18} />
                  </Button>
                </Grid.Col>
              </Grid>
            </Box>
          ))}

          {/* Add More Button - Hidden in view mode */}
          {!viewMode && (
            <Flex justify="flex-end" mt="md">
              <Button
                variant="outline"
                color="#105476"
                leftSection={<IconPlus size={16} />}
                onClick={handleAddNewProfile}
              >
                {profilingForm.values.profiles.length > 0
                  ? "Add More"
                  : "Add New"}
              </Button>
            </Flex>
          )}
        </Box>
      )}

      {/* Submit Buttons - Only show when customer is selected */}
      {selectedCustomerCode && (
        <Stack justify="space-between" mt="5%">
          <Divider my="md" />
          <Flex gap="md" justify={"end"}>
            <Button
              variant="outline"
              c="#105476"
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              onClick={() => {
                const returnTo = (routerLocation.state as { returnTo?: string })
                  ?.returnTo;
                if (returnTo) {
                  navigate(returnTo);
                } else {
                  const historyLength = window.history.length;
                  if (historyLength > 1) {
                    navigate(-1);
                  } else {
                    navigate("/pipeline");
                  }
                }
              }}
            >
              {viewMode ? "Back" : "Cancel"}
            </Button>
            {!viewMode && (
              <Button
                type="submit"
                color="#105476"
                rightSection={<IconCheck size={16} />}
              >
                Submit
              </Button>
            )}
          </Flex>
        </Stack>
      )}
    </Box>
  );
}

export default PipelineCreate;
