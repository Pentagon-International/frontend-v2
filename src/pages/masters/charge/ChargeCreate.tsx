import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Group,
  Select,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { ToastNotification } from "../../../components";
import { URL } from "../../../api/serverUrls";

type ChargeFormData = {
  charge_code: string;
  charge_name: string;
  charges_type: string;
  calculation_type: string;
};

const chargesTypeOptions = [
  { value: "FREIGHT", label: "FREIGHT" },
  { value: "ORIGIN", label: "ORIGIN" },
  { value: "DESTINATION", label: "DESTINATION" },
  { value: "OTHER", label: "OTHER" },
];

const calculationTypeOptions = [
  { value: "PER_CONTAINER", label: "PER_CONTAINER" },
  { value: "PERCENTAGE", label: "PERCENTAGE" },
  { value: "SHIPMENT", label: "SHIPMENT" },
  { value: "UNIT", label: "UNIT" },
];

const schema = yup.object().shape({
  charge_code: yup.string().required("Charge code is required"),
  charge_name: yup.string().required("Charge name is required"),
  charges_type: yup.string().required("Charges type is required"),
  calculation_type: yup.string().required("Calculation type is required"),
});

export default function ChargeCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get edit data from location.state
  const editData = (location.state as ChargeFormData & { id?: string }) || null;
  const isEditMode = !!editData?.id;

  const form = useForm<ChargeFormData>({
    initialValues: {
      charge_code: "",
      charge_name: "",
      charges_type: "",
      calculation_type: "",
    },
    validate: yupResolver(schema),
  });

  // Populate form when edit data is available
  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        charge_code: editData.charge_code || "",
        charge_name: editData.charge_name || "",
        charges_type: editData.charges_type || "",
        calculation_type: editData.calculation_type || "",
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: ChargeFormData) => {
    setIsSubmitting(true);

    try {
      let response;

      if (isEditMode) {
        // Update existing charge using PUT
        const updateData = {
          ...values,
          id: editData.id,
        };
        response = await putAPICall(URL.chargeMaster, updateData, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Charge updated successfully",
        });
      } else {
        // Create new charge using POST
        response = await postAPICall(URL.chargeMaster, values, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Charge created successfully",
        });
      }

      // Navigate back to charge list with refresh flag
      navigate("/master/charge");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} charge: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/charge");
  };

  return (
    <Box
      component="form"
      onSubmit={form.onSubmit(handleSubmit)}
      style={{
        backgroundColor: "#F8F8F8",
        position: "relative",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <Box p="sm" mx="auto" style={{ backgroundColor: "#F8F8F8" }}>
        <Flex
          gap="md"
          align="flex-start"
          style={{ height: "calc(100vh - 112px)", width: "100%" }}
        >
          {/* Side Heading Area */}
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
                c="#2563EB"
                style={{
                  fontFamily: "Inter",
                  fontStyle: "medium",
                  fontSize: "16px",
                  color: "#2563EB",
                  textAlign: "center",
                }}
              >
                {isEditMode ? "Edit Charge" : "Create Charge"}
              </Text>
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box
            style={{
              flex: 1,
              // backgroundColor: "#ffffff",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
            }}
          >
            <Box
              style={{
                flex: 1,
                overflowY: "auto",
                paddingBottom: "8px",
                backgroundColor: "#F8F8F8",
              }}
            >
              <Grid style={{ backgroundColor: "#FFFFFF", height:"100%", borderRadius:"8px", padding: "24px" }}>
                <Grid.Col span={6}>
                  <TextInput
                    label="Charge Code"
                    placeholder="Enter charge code"
                    withAsterisk
                    {...form.getInputProps("charge_code")}
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#424242",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <TextInput
                    label="Charge Name"
                    placeholder="Enter charge name"
                    withAsterisk
                    {...form.getInputProps("charge_name")}
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#424242",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <Select
                    label="Charges Type"
                    placeholder="Select charges type"
                    withAsterisk
                    searchable
                    data={chargesTypeOptions}
                    {...form.getInputProps("charges_type")}
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#424242",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <Select
                    label="Calculation Type"
                    placeholder="Select calculation type"
                    withAsterisk
                    searchable
                    data={calculationTypeOptions}
                    {...form.getInputProps("calculation_type")}
                    styles={{
                      input: {
                        fontSize: "13px",
                        fontFamily: "Inter",
                      },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#424242",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                        fontStyle: "medium",
                      },
                    }}
                  />
                </Grid.Col>
              </Grid>
            </Box>

            {/* Footer Buttons */}
            <Box
              style={{
                // borderTop: "1px solid #e9ecef",
                borderRadius:"8px",
                padding: "20px 32px",
                backgroundColor: "#ffffff",
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
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </Group>

                <Group gap="sm">
                  <Button
                    type="submit"
                    size="sm"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={{
                      backgroundColor: "#2563EB",
                      fontSize: "13px",
                      fontFamily: "Inter",
                      fontStyle: "medium",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                    }}
                    rightSection={<IconCheck size={16} />}
                  >
                    {isEditMode ? "Update" : "Create"}
                  </Button>
                </Group>
              </Group>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}
