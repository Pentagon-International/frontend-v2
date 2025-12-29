import { useEffect, useState, useMemo, useRef } from "react";
import { ToastNotification } from "../../../components";
import { API_HEADER } from "../../../store/storeKeys";
import { URL } from "../../../api/serverUrls";
import {
  Box,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Text,
  Select,
  Loader,
  Tooltip,
  Flex,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { yupResolver } from "mantine-form-yup-resolver";
import * as yup from "yup";
import {
  IconArrowLeft,
  IconCheck,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { SearchableSelect } from "../../../components";
import { apiCallProtected } from "../../../api/axios";
import { getAPICall } from "../../../service/getApiCall";

type RelationshipDetail = {
  id?: number; // Optional - only exists for existing entries in edit mode
  emp_id_input: string;
  relationship_type: string;
  service_id: number | null;
  branch_id: number | null;
};

type CustomerRelationshipMappingFormData = {
  customer_id: number | null;
  customer_relationship_details: RelationshipDetail[];
};

const relationshipDetailSchema = yup.object({
  emp_id_input: yup.string().required("Salesperson Name is required"),
  relationship_type: yup.string().required("Relationship Type is required"),
  service_id: yup.number().nullable(),
  branch_id: yup.number().nullable(),
});

const validationSchema = yup.object({
  customer_id: yup.number().required("Customer Name is required"),
  customer_relationship_details: yup
    .array()
    .of(relationshipDetailSchema)
    .min(1, "At least one relationship detail is required"),
});

type EditResponseItem = {
  sno: number;
  id: number;
  customer_id: number;
  customer_code: string;
  customer_name: string;
  emp_id_display: string;
  emp_name: string;
  relationship_type: string;
  service_id: number;
  service_code: string;
  service_name: string;
  branch_id: number | null;
  branch_code: string | null;
  branch_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function CustomerRelationshipMappingCreate() {
  const navigate = useNavigate();
  const location = useLocation();

  // Check user permissions from localStorage
  const hasManagerOrStaffAccess = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return false;
      const user = JSON.parse(userStr);
      return user?.is_manager === true || user?.is_staff === true;
    } catch (error) {
      console.error("Error checking user permissions:", error);
      return false;
    }
  }, []);

  // Redirect unauthorized users to /master
  useEffect(() => {
    if (!hasManagerOrStaffAccess) {
      navigate("/master", { replace: true });
    }
  }, [hasManagerOrStaffAccess, navigate]);

  // Check if we're in edit mode based on location pathname and state
  const isEditMode = location.pathname.includes("/edit");
  const locationState = location.state as {
    customer_id?: number;
    fromCustomerMaster?: boolean;
    customerFormData?: any;
    addressFormData?: any;
  } | null;
  const customerIdFromState = locationState?.customer_id || null;
  const fromCustomerMaster = locationState?.fromCustomerMaster || false;
  const customerFormDataFromState = locationState?.customerFormData || null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);
  
  // Display name states for customer
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(null);
  
  // Branch options state - array for each relationship detail index
  const [branchOptionsMap, setBranchOptionsMap] = useState<Record<number, Array<{ value: string; label: string }>>>({});
  const [isLoadingBranchesMap, setIsLoadingBranchesMap] = useState<Record<number, boolean>>({});
  
  // Display names state - array for each relationship detail index
  const [displayNamesMap, setDisplayNamesMap] = useState<Record<number, {
    salesperson?: string | null;
    service?: string | null;
    branch?: string | null;
  }>>({});

  // Custom validation function that allows null customer_id when fromCustomerMaster
  const validateForm = useMemo(() => {
    if (fromCustomerMaster) {
      // When from customer master, customer_id can be null (will be created on submit)
      return (values: CustomerRelationshipMappingFormData) => {
        const errors: Record<string, string> = {};
        
        // Validate customer_relationship_details
        if (!values.customer_relationship_details || values.customer_relationship_details.length === 0) {
          errors.customer_relationship_details = "At least one relationship detail is required";
        } else {
          values.customer_relationship_details.forEach((detail, index) => {
            if (!detail.emp_id_input) {
              errors[`customer_relationship_details.${index}.emp_id_input`] = "Salesperson Name is required";
            }
            if (!detail.relationship_type) {
              errors[`customer_relationship_details.${index}.relationship_type`] = "Relationship Type is required";
            }
          });
        }
        
        return errors;
      };
    } else {
      // Normal validation - customer_id is required
      return yupResolver(validationSchema) as unknown as (
        values: CustomerRelationshipMappingFormData
      ) => Record<string, string>;
    }
  }, [fromCustomerMaster]);

  const form = useForm<CustomerRelationshipMappingFormData>({
    validate: validateForm,
    initialValues: {
      customer_id: null,
      customer_relationship_details: [
        {
          emp_id_input: "",
          relationship_type: "Sales",
          service_id: null,
          branch_id: null,
        },
      ],
    },
  });

  // Initialize customer name when coming from customer master
  useEffect(() => {
    if (fromCustomerMaster && customerFormDataFromState) {
      // Pre-fill customer name from customer master form data
      setCustomerDisplayName(customerFormDataFromState.customer_name || null);
      // Note: customer_id will be null initially, will be set after customer creation
    }
  }, [fromCustomerMaster, customerFormDataFromState]);

  // Function to fetch branches by employee ID for a specific index
  const fetchBranchesByEmployeeId = async (employeeId: string, index: number) => {
    if (!employeeId) {
      setBranchOptionsMap(prev => ({ ...prev, [index]: [] }));
      form.setFieldValue(`customer_relationship_details.${index}.branch_id`, null);
      setDisplayNamesMap(prev => ({
        ...prev,
        [index]: { ...prev[index], branch: null },
      }));
      return;
    }

    try {
      setIsLoadingBranchesMap(prev => ({ ...prev, [index]: true }));
      setBranchOptionsMap(prev => ({ ...prev, [index]: [] }));
      
      const response = (await apiCallProtected.post(
        `${URL.branchMaster}by-employee-id/`,
        { employee_id: employeeId }
      )) as {
        success?: boolean;
        message?: string;
        data?: Array<Record<string, unknown>>;
        total?: number;
      };

      if (response?.success && response?.data && Array.isArray(response.data)) {
        const options = response.data.map((branch: Record<string, unknown>) => ({
          value: String(branch.id || ""),
          label: String(branch.branch_name || ""),
        }));
        setBranchOptionsMap(prev => ({ ...prev, [index]: options }));
      } else {
        setBranchOptionsMap(prev => ({ ...prev, [index]: [] }));
      }
    } catch (error) {
      console.error("Error fetching branches by employee ID:", error);
      ToastNotification({
        type: "error",
        message: "Failed to fetch branch options",
      });
      setBranchOptionsMap(prev => ({ ...prev, [index]: [] }));
    } finally {
      setIsLoadingBranchesMap(prev => ({ ...prev, [index]: false }));
    }
  };

  // Fetch edit data by customer_id - use ref to prevent multiple calls
  const hasFetchedEditData = useRef(false);

  // Reset fetch flag when route changes
  useEffect(() => {
    hasFetchedEditData.current = false;
    setIsFormInitialized(false);
  }, [location.pathname, customerIdFromState]);

  // Fetch edit data by customer_id
  useEffect(() => {
    if (isEditMode && customerIdFromState && !hasFetchedEditData.current && !isLoadingEditData) {
      hasFetchedEditData.current = true;
      const fetchEditData = async () => {
        try {
          setIsLoadingEditData(true);
          const response = await getAPICall(
            `${URL.customerRelationshipMappingByCustomer}?customer_id=${customerIdFromState}`,
            API_HEADER
          ) as EditResponseItem[];

          if (Array.isArray(response) && response.length > 0) {
            // Get customer info from first item
            const firstItem = response[0];
            
            // Map response to form structure - include id for existing entries
            const relationshipDetails: RelationshipDetail[] = response.map((item) => ({
              id: item.id, // Include id for existing entries
              emp_id_input: item.emp_id_display || "",
              relationship_type: item.relationship_type || "Sales",
              service_id: item.service_id || null,
              branch_id: item.branch_id || null,
            }));

            // Set form values
            form.setValues({
              customer_id: firstItem.customer_id,
              customer_relationship_details: relationshipDetails,
            });

            // Set customer display name
            setCustomerDisplayName(firstItem.customer_name || null);

            // Set display names and branch options for each relationship detail
            const newDisplayNamesMap: Record<number, {
              salesperson?: string | null;
              service?: string | null;
              branch?: string | null;
            }> = {};
            const newBranchOptionsMap: Record<number, Array<{ value: string; label: string }>> = {};

            response.forEach((item, index) => {
              newDisplayNamesMap[index] = {
                salesperson: item.emp_name || null,
                service: item.service_name || null,
                branch: item.branch_name || null,
              };

              // If branch_id and branch_name exist, add to branch options
              if (item.branch_id && item.branch_name) {
                newBranchOptionsMap[index] = [{
                  value: String(item.branch_id),
                  label: item.branch_name,
                }];
              } else {
                newBranchOptionsMap[index] = [];
              }
            });

            setDisplayNamesMap(newDisplayNamesMap);
            setBranchOptionsMap(newBranchOptionsMap);

            setIsFormInitialized(true);
          } else {
            // No entries found - if coming from Customer Master, show create mode with customer_id pre-filled
            if (fromCustomerMaster && customerIdFromState) {
              // Set customer_id in form and initialize with empty relationship details
              form.setValues({
                customer_id: customerIdFromState,
                customer_relationship_details: [
                  {
                    emp_id_input: "",
                    relationship_type: "Sales",
                    service_id: null,
                    branch_id: null,
                  },
                ],
              });
              // Set customer display name from form data if available
              if (customerFormDataFromState?.customer_name) {
                setCustomerDisplayName(customerFormDataFromState.customer_name);
              }
              setIsFormInitialized(true);
            } else {
              // Not from Customer Master - show error and navigate back
              ToastNotification({
                type: "error",
                message: "No relationship details found for this customer",
              });
              navigate("/master/customer-relationship-mapping");
            }
          }
        } catch (error) {
          console.error("Error fetching edit data:", error);
          // If coming from Customer Master, show create mode with customer_id pre-filled
          if (fromCustomerMaster && customerIdFromState) {
            form.setValues({
              customer_id: customerIdFromState,
              customer_relationship_details: [
                {
                  emp_id_input: "",
                  relationship_type: "Sales",
                  service_id: null,
                  branch_id: null,
                },
              ],
            });
            // Set customer display name from form data if available
            if (customerFormDataFromState?.customer_name) {
              setCustomerDisplayName(customerFormDataFromState.customer_name);
            }
            setIsFormInitialized(true);
          } else {
            ToastNotification({
              type: "error",
              message: "Failed to load relationship details",
            });
            navigate("/master/customer-relationship-mapping");
          }
        } finally {
          setIsLoadingEditData(false);
        }
      };

      fetchEditData();
    }
  }, [isEditMode, customerIdFromState, isLoadingEditData, form, navigate]);

  const handleSubmit = async (values: CustomerRelationshipMappingFormData) => {
    try {
      setIsSubmitting(true);

      let finalCustomerId = values.customer_id;

      // If coming from customer master and customer_id is not set, create customer first
      if (fromCustomerMaster && !finalCustomerId && customerFormDataFromState) {
        try {
          // Create customer first
          const customerPayload = {
            customer_name: customerFormDataFromState.customer_name,
            customer_type_code: customerFormDataFromState.customer_type_code,
            term_code: customerFormDataFromState.term_code,
            own_office: customerFormDataFromState.own_office === "true",
            assigned_to: customerFormDataFromState.assigned_to,
            addresses_data: (locationState?.addressFormData?.addresses_data || []).map((addr: any) => ({
              ...addr,
              address_type: addr.address_type === "Primary" ? "Primary" : addr.address_type,
            })),
          };

          const customerResponse = await postAPICall(URL.customer, customerPayload, API_HEADER) as any;
          
          // Get customer_id from response - check multiple possible response structures
          finalCustomerId = customerResponse?.id || 
                           customerResponse?.customer_id || 
                           customerResponse?.data?.id || 
                           customerResponse?.data?.customer_id ||
                           null;
          
          if (!finalCustomerId) {
            // Log response for debugging
            console.error("Customer creation response:", customerResponse);
            throw new Error("Customer created but customer_id not found in response");
          }
          
          // Update form with the customer_id for reference
          form.setFieldValue("customer_id", finalCustomerId);

          ToastNotification({
            type: "success",
            message: "Customer created successfully!",
          });
        } catch (error) {
          console.error("Error creating customer:", error);
          ToastNotification({
            type: "error",
            message: "Failed to create customer. Please try again.",
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (!finalCustomerId) {
        ToastNotification({
          type: "error",
          message: "Customer ID is required. Please select a customer.",
        });
        setIsSubmitting(false);
        return;
      }

      // If coming from customer master edit mode, update customer first
      if (fromCustomerMaster && isEditMode && customerIdFromState && customerFormDataFromState) {
        try {
          // Update customer first
          const customerPayload = {
            id: customerIdFromState,
            customer_name: customerFormDataFromState.customer_name,
            customer_type_code: customerFormDataFromState.customer_type_code,
            term_code: customerFormDataFromState.term_code,
            own_office: customerFormDataFromState.own_office === "true",
            assigned_to: customerFormDataFromState.assigned_to,
            addresses_data: (locationState?.addressFormData?.addresses_data || []).map((addr: any) => ({
              ...addr,
              address_type: addr.address_type === "Primary" ? "Primary" : addr.address_type,
            })),
          };

          await putAPICall(URL.customer, customerPayload, API_HEADER);
          
          ToastNotification({
            type: "success",
            message: "Customer updated successfully!",
          });
        } catch (error) {
          console.error("Error updating customer:", error);
          ToastNotification({
            type: "error",
            message: "Failed to update customer. Please try again.",
          });
          setIsSubmitting(false);
          return;
        }
      }

      const payload = {
        customer_id: finalCustomerId,
        customer_relationship_details: values.customer_relationship_details.map((detail) => {
          const detailPayload: Record<string, unknown> = {
            emp_id_input: detail.emp_id_input,
            relationship_type: detail.relationship_type,
            service_id: detail.service_id,
            branch_id: detail.branch_id,
          };
          // Include id if it exists (for existing entries in edit mode)
          if (detail.id !== undefined && detail.id !== null) {
            detailPayload.id = detail.id;
          }
          return detailPayload;
        }),
      };

      if (isEditMode && customerIdFromState) {
        // Use bulk-update endpoint for edit mode
        await apiCallProtected.put(URL.customerRelationshipMappingBulkUpdate, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Customer Relationship Mapping updated successfully!",
        });
      } else {
        await postAPICall(URL.customerRelationshipMapping, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Customer Relationship Mapping created successfully!",
        });
      }

      // Navigate based on source
      if (fromCustomerMaster) {
        // Always navigate to customer list page after successful update/create
        navigate("/master/customer", { state: { refreshData: true } });
      } else {
        navigate("/master/customer-relationship-mapping", { state: { refreshData: true } });
      }
    } catch (error) {
      console.error("Error submitting customer relationship mapping:", error);
      ToastNotification({
        type: "error",
        message: `Failed to ${
          isEditMode ? "update" : "create"
        } customer relationship mapping. Please try again.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if user doesn't have access
  if (!hasManagerOrStaffAccess) {
    return null;
  }


  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)}>
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600} c="#105476">
          {isEditMode
            ? "Edit Customer Relationship Mapping"
            : "Create Customer Relationship Mapping"}
        </Text>
        <Button
          variant="outline"
          color="#105476"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => {
            if (fromCustomerMaster && customerFormDataFromState) {
              // Determine if we're in edit mode based on customer_id existence
              if (customerIdFromState) {
                // Navigate back to customer master edit with form data
                navigate(`/master/customer/edit/${customerIdFromState}`, {
                  state: {
                    customerFormData: customerFormDataFromState,
                    addressFormData: locationState?.addressFormData,
                    relationshipFormData: form.values,
                  },
                });
              } else {
                // Navigate back to customer master create with form data
                navigate("/master/customer/create", {
                  state: {
                    customerFormData: customerFormDataFromState,
                    addressFormData: locationState?.addressFormData,
                    relationshipFormData: form.values,
                  },
                });
              }
            } else {
              navigate("/master/customer-relationship-mapping");
            }
          }}
        >
          {fromCustomerMaster ? "Back to Customer Master" : "Back to List"}
        </Button>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
      {isLoadingEditData ? (
        <Box>
          <Stack w="100%" justify="center" align="center" mt="xl" gap="lg">
            <Loader size="lg" />
            <Text c="dimmed">Loading relationship details...</Text>
          </Stack>
        </Box>
      ) : (
        <>
            <Stack gap="lg">
              {/* Customer Name - Always enabled */}
              <Grid gutter="md">
                <Grid.Col span={5.5}>
                  <SearchableSelect
                    label="Customer Name"
                    placeholder={fromCustomerMaster ? "Customer from Customer Master" : "Type customer name"}
                    apiEndpoint={URL.customer}
                    searchFields={["customer_name", "customer_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id || ""),
                      label: String(item.customer_name || ""),
                    })}
                    value={form.values.customer_id ? String(form.values.customer_id) : ""}
                    displayValue={customerDisplayName}
                    withAsterisk={true}
                    returnOriginalData={true}
                    disabled={isEditMode || fromCustomerMaster}
                    onChange={(value, selectedData, originalData) => {
                      if (value === null || value === "") {
                        form.setFieldValue("customer_id", null);
                        setCustomerDisplayName(null);
                      } else {
                        const customerId = originalData?.id ? Number(originalData.id) : null;
                        form.setFieldValue("customer_id", customerId);
                        setCustomerDisplayName(selectedData?.label || null);
                      }
                    }}
                    error={!fromCustomerMaster && form.errors.customer_id}
                    minSearchLength={2}
                  />
                </Grid.Col>
              </Grid>

              {/* Relationship Details - Multiple Entries */}
              <Stack gap="md">
                {form.values.customer_relationship_details.map((detail, index) => (
                  <Box key={index}>
                    <Grid gutter="md" columns={12}>
                      {/* Branch Name - Order 1 */}
                      <Grid.Col span={2.75}>
                        <Tooltip
                          label={
                            (!form.values.customer_id && !fromCustomerMaster)
                              ? "Select Customer first"
                              : !detail.emp_id_input
                              ? "Select Salesperson first"
                              : isLoadingBranchesMap[index]
                              ? "Branches are loading"
                              : (branchOptionsMap[index]?.length || 0) === 0
                              ? "No branches available"
                              : ""
                          }
                          withArrow
                          disabled={
                            !!((form.values.customer_id || fromCustomerMaster) &&
                            detail.emp_id_input &&
                            !isLoadingBranchesMap[index] &&
                            (branchOptionsMap[index]?.length || 0) > 0)
                          }
                          withinPortal
                          position="top"
                        >
                          <Select
                            key={`branch-select-${index}-${detail.emp_id_input || 'none'}`}
                            label="Branch Name"
                            placeholder={isLoadingBranchesMap[index] ? "Loading branches..." : "Select branch name"}
                            searchable
                            data={branchOptionsMap[index] || []}
                            value={detail.branch_id ? String(detail.branch_id) : null}
                            onChange={(value) => {
                              if (value === null || value === "") {
                                form.setFieldValue(`customer_relationship_details.${index}.branch_id`, null);
                                setDisplayNamesMap(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], branch: null },
                                }));
                              } else {
                                const branchId = value ? Number(value) : null;
                                form.setFieldValue(`customer_relationship_details.${index}.branch_id`, branchId);
                                const selectedBranch = (branchOptionsMap[index] || []).find(opt => opt.value === value);
                                setDisplayNamesMap(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], branch: selectedBranch?.label || null },
                                }));
                              }
                            }}
                            error={((form.errors.customer_relationship_details as Record<string, any>)?.[index] as Record<string, string>)?.branch_id}
                            disabled={
                              (!form.values.customer_id && !fromCustomerMaster) ||
                              !detail.emp_id_input ||
                              isLoadingBranchesMap[index] ||
                              (branchOptionsMap[index]?.length || 0) === 0
                            }
                            rightSection={isLoadingBranchesMap[index] ? <Loader size="xs" /> : undefined}
                            clearable
                          />
                        </Tooltip>
                      </Grid.Col>

                      {/* Service Name - Order 2 */}
                      <Grid.Col span={2.75}>
                        <SearchableSelect
                          label="Service Name"
                          placeholder="Type service name"
                          apiEndpoint={URL.serviceMaster}
                          searchFields={["service_name", "service_code"]}
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.id || ""),
                            label: String(item.service_name || ""),
                          })}
                          value={detail.service_id ? String(detail.service_id) : ""}
                          displayValue={displayNamesMap[index]?.service}
                          returnOriginalData={true}
                          onChange={(value, selectedData, originalData) => {
                            if (value === null || value === "") {
                              form.setFieldValue(`customer_relationship_details.${index}.service_id`, null);
                              setDisplayNamesMap(prev => ({
                                ...prev,
                                [index]: { ...prev[index], service: null },
                              }));
                            } else {
                              const serviceId = originalData?.id 
                                ? Number(originalData.id) 
                                : (value ? Number(value) : null);
                              form.setFieldValue(`customer_relationship_details.${index}.service_id`, serviceId);
                              setDisplayNamesMap(prev => ({
                                ...prev,
                                [index]: {
                                  ...prev[index],
                                  service: selectedData?.label || (originalData?.service_name ? String(originalData.service_name) : null),
                                },
                              }));
                            }
                          }}
                          error={((form.errors.customer_relationship_details as Record<string, any>)?.[index] as Record<string, string>)?.service_id}
                          minSearchLength={2}
                          disabled={!form.values.customer_id && !fromCustomerMaster}
                        />
                      </Grid.Col>

                      {/* Relationship Type - Order 3 */}
                      <Grid.Col span={2.75}>
                        <Select
                          label="Relationship Type"
                          placeholder="Select relationship type"
                          searchable
                          withAsterisk
                          data={["Sales"]}
                          value={detail.relationship_type}
                          onChange={(value) => form.setFieldValue(`customer_relationship_details.${index}.relationship_type`, value || "Sales")}
                          error={((form.errors.customer_relationship_details as Record<string, any>)?.[index] as Record<string, string>)?.relationship_type}
                          disabled={!form.values.customer_id && !fromCustomerMaster}
                          clearable={false}
                        />
                      </Grid.Col>

                      {/* Salesperson Name - Order 4 */}
                      <Grid.Col span={2.75}>
                        <SearchableSelect
                          label="Salesperson Name"
                          placeholder="Type salesperson name"
                          apiEndpoint={URL.user}
                          searchFields={["user_name", "employee_id", "user_id"]}
                          displayFormat={(item: Record<string, unknown>) => ({
                            value: String(item.employee_id || ""),
                            label: String(item.user_name || ""),
                          })}
                          value={detail.emp_id_input}
                          displayValue={displayNamesMap[index]?.salesperson}
                          returnOriginalData={true}
                          withAsterisk={true}
                          onChange={(value, selectedData, originalData) => {
                            const empId = originalData?.employee_id 
                              ? String(originalData.employee_id) 
                              : value || "";
                            
                            form.setFieldValue(`customer_relationship_details.${index}.emp_id_input`, empId);
                            setDisplayNamesMap(prev => ({
                              ...prev,
                              [index]: { ...prev[index], salesperson: selectedData?.label || null },
                            }));
                            
                            // Clear branch when salesperson changes
                            form.setFieldValue(`customer_relationship_details.${index}.branch_id`, null);
                            setDisplayNamesMap(prev => ({
                              ...prev,
                              [index]: { ...prev[index], branch: null },
                            }));
                            
                            // Fetch branches for the selected employee
                            if (empId) {
                              fetchBranchesByEmployeeId(empId, index);
                            } else {
                              setBranchOptionsMap(prev => ({ ...prev, [index]: [] }));
                            }
                          }}
                          error={((form.errors.customer_relationship_details as Record<string, any>)?.[index] as Record<string, string>)?.emp_id_input}
                          minSearchLength={2}
                          disabled={!form.values.customer_id && !fromCustomerMaster}
                        />
                      </Grid.Col>

                      {form.values.customer_relationship_details.length > 1 && (
                        <Grid.Col span={1} style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
                          <Button
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => {
                              form.removeListItem("customer_relationship_details", index);
                              // Clean up branch options and display names for removed index
                              setBranchOptionsMap(prev => {
                                const newMap = { ...prev };
                                delete newMap[index];
                                // Reindex remaining entries
                                const reindexed: Record<number, Array<{ value: string; label: string }>> = {};
                                Object.keys(newMap).forEach(key => {
                                  const oldIndex = Number(key);
                                  if (oldIndex > index) {
                                    reindexed[oldIndex - 1] = newMap[oldIndex];
                                  } else if (oldIndex < index) {
                                    reindexed[oldIndex] = newMap[oldIndex];
                                  }
                                });
                                return reindexed;
                              });
                              setDisplayNamesMap(prev => {
                                const newMap = { ...prev };
                                delete newMap[index];
                                const reindexed: Record<number, {
                                  salesperson?: string | null;
                                  service?: string | null;
                                  branch?: string | null;
                                }> = {};
                                Object.keys(newMap).forEach(key => {
                                  const oldIndex = Number(key);
                                  if (oldIndex > index) {
                                    reindexed[oldIndex - 1] = newMap[oldIndex];
                                  } else if (oldIndex < index) {
                                    reindexed[oldIndex] = newMap[oldIndex];
                                  }
                                });
                                return reindexed;
                              });
                            }}
                          >
                            <IconTrash size={20} />
                          </Button>
                        </Grid.Col>
                      )}
                    </Grid>
                  </Box>
                ))}
              </Stack>

              {/* Add Button */}
              <Flex justify="end" align="center" mt="md">
                <Button
                  variant="light"
                  color="#105476"
                  leftSection={<IconPlus size={16} />}
                  onClick={() =>
                    form.insertListItem("customer_relationship_details", {
                      emp_id_input: "",
                      relationship_type: "Sales",
                      service_id: null,
                      branch_id: null,
                    })
                  }
                  disabled={!form.values.customer_id && !fromCustomerMaster}
                >
                  Add Relationship Detail
                </Button>
              </Flex>

              <Group justify="flex-end" mt="xl">
                <Button
                  variant="outline"
                  color="#105476"
                  onClick={() => {
                    if (fromCustomerMaster && customerFormDataFromState) {
                      // Determine if we're in edit mode based on customer_id existence
                      if (customerIdFromState) {
                        // Navigate back to customer master edit with form data
                        navigate(`/master/customer/edit/${customerIdFromState}`, {
                          state: {
                            customerFormData: customerFormDataFromState,
                            addressFormData: locationState?.addressFormData,
                            relationshipFormData: form.values,
                          },
                        });
                      } else {
                        // Navigate back to customer master create with form data
                        navigate("/master/customer/create", {
                          state: {
                            customerFormData: customerFormDataFromState,
                            addressFormData: locationState?.addressFormData,
                            relationshipFormData: form.values,
                          },
                        });
                      }
                    } else {
                      navigate("/master/customer-relationship-mapping");
                    }
                  }}
                >
                  {fromCustomerMaster ? "Back to Customer Master" : "Cancel"}
                </Button>
                <Button
                  type="submit"
                  color="#105476"
                  leftSection={<IconCheck size={16} />}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? isEditMode
                      ? "Updating..."
                      : "Creating..."
                    : isEditMode
                    ? "Update"
                    : "Create"}
                </Button>
              </Group>
            </Stack>
        </>
      )}
      </Card>
    </Box>
  );
}

export default CustomerRelationshipMappingCreate;
