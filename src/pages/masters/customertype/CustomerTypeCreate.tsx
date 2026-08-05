import { useEffect, useState } from "react";
import { Box, Button, Flex, Grid, Group, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { Dropdown, ToastNotification } from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { URL } from "../../../api/serverUrls";

const CUSTOMER_CATEGORY_OPTIONS = [
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "agent", label: "Agent" },
];

type CustomerTypeFormData = {
  customer_type_name: string;
  customer_category: string;
  status: string;
};

const fieldStyles = {
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
};

const schema = yup.object().shape({
  customer_type_name: yup.string().required("Customer type name is required"),
  customer_category: yup.string().required("Customer category is required"),
});

export default function CustomerTypeCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData =
    (location.state as CustomerTypeFormData & {
      id?: number;
      customer_type_code?: string;
    }) || null;
  const isEditMode = !!editData?.id;
  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.customerType : undefined,
        recordId: editData?.id,
        enabled: isEditMode,
      },
    );

  const form = useForm<CustomerTypeFormData>({
    initialValues: {
      customer_type_name: "",
      customer_category: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        customer_type_name: editData.customer_type_name || "",
        customer_category: (editData.customer_category || "").toLowerCase(),
        status: editData.status || "ACTIVE",
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: CustomerTypeFormData) => {
    setIsSubmitting(true);

    try {
      const payload = {
        customer_type_name: values.customer_type_name.trim(),
        customer_category: values.customer_category,
        status: values.status || "ACTIVE",
      };

      if (isEditMode && editData?.id != null) {
        const res = await putAPICall(
          URL.customerType,
          {
            ...payload,
            id: editData.id,
          },
          API_HEADER,
        );
        applyAuditFromResponse(res);
        await refreshAuditFromDetail(editData.id);
        ToastNotification({
          type: "success",
          message: "Customer Type updated successfully",
        });
      } else {
        await postAPICall(URL.customerType, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Customer Type created successfully",
        });
      }

      navigate("/master/customer-type", { state: { refreshData: true } });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} Customer Type: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/customer-type");
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
              <MasterAuditHeadingRow
                auditSource={auditSource}
                visible={isEditMode}
                justify="center"
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
                  {isEditMode ? "Edit Customer Type" : "Create Customer Type"}
                </Text>
              </MasterAuditHeadingRow>
            </Box>
          </Box>

          <Box
            style={{
              flex: 1,
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
              <Grid
                style={{
                  backgroundColor: "#FFFFFF",
                  height: "100%",
                  borderRadius: "8px",
                  padding: "24px",
                }}
              >
                {isEditMode && editData?.customer_type_code ? (
                  <Grid.Col span={6}>
                    <TextInput
                      label="Customer Type Code"
                      value={editData.customer_type_code}
                      disabled
                      styles={fieldStyles}
                    />
                  </Grid.Col>
                ) : null}

                <Grid.Col span={6}>
                  <TextInput
                    label="Customer Type Name"
                    placeholder="Enter customer type name"
                    withAsterisk
                    {...form.getInputProps("customer_type_name")}
                    styles={fieldStyles}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <Dropdown
                    label="Customer Category"
                    placeholder="Select customer category"
                    withAsterisk
                    data={CUSTOMER_CATEGORY_OPTIONS}
                    value={form.values.customer_category || null}
                    onChange={(value) =>
                      form.setFieldValue("customer_category", value || "")
                    }
                    error={form.errors.customer_category}
                    styles={fieldStyles}
                  />
                </Grid.Col>

                {isEditMode ? (
                  <Grid.Col span={6}>
                    <Dropdown
                      label="Status"
                      placeholder="Select status"
                      data={["ACTIVE", "INACTIVE"]}
                      value={form.values.status || null}
                      onChange={(value) =>
                        form.setFieldValue("status", value || "ACTIVE")
                      }
                      styles={fieldStyles}
                    />
                  </Grid.Col>
                ) : null}
              </Grid>
            </Box>

            <Box
              style={{
                borderRadius: "8px",
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
                      backgroundColor: "#105476",
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
