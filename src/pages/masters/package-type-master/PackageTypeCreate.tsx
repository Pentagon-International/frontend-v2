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

type PackageTypeFormData = {
  package_type_code: string;
  package_type_name: string;
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
  package_type_code: yup.string().required("Package type code is required"),
  package_type_name: yup.string().required("Package type name is required"),
});

export default function PackageTypeCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData =
    (location.state as PackageTypeFormData & { id?: number }) || null;
  const isEditMode = !!editData?.id;
  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.packageTypeMaster : undefined,
        recordId: editData?.id,
        enabled: isEditMode,
      },
    );

  const form = useForm<PackageTypeFormData>({
    initialValues: {
      package_type_code: "",
      package_type_name: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        package_type_code: editData.package_type_code || "",
        package_type_name: editData.package_type_name || "",
        status: editData.status || "ACTIVE",
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: PackageTypeFormData) => {
    setIsSubmitting(true);

    try {
      const payload = {
        package_type_code: values.package_type_code.trim(),
        package_type_name: values.package_type_name.trim(),
        status: values.status || "ACTIVE",
      };

      if (isEditMode && editData?.id != null) {
        const res = await putAPICall(
          URL.packageTypeMaster,
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
          message: "Package Type updated successfully",
        });
      } else {
        await postAPICall(URL.packageTypeMaster, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Package Type created successfully",
        });
      }

      navigate("/master/package-type", { state: { refreshData: true } });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} Package Type: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/package-type");
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
                  {isEditMode ? "Edit Package Type" : "Create Package Type"}
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
                <Grid.Col span={6}>
                  <TextInput
                    label="Package Type Code"
                    placeholder="Enter package type code"
                    withAsterisk
                    {...form.getInputProps("package_type_code")}
                    styles={fieldStyles}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <TextInput
                    label="Package Type Name"
                    placeholder="Enter package type name"
                    withAsterisk
                    {...form.getInputProps("package_type_name")}
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
