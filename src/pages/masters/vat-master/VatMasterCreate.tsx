import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Group,
  NumberInput,
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
import { Dropdown, ToastNotification } from "../../../components";
import { URL } from "../../../api/serverUrls";
import useAuthStore from "../../../store/authStore";
import { isIndianUserFromProfile } from "../../../utils/userNumberFormat";

type VatMasterFormData = {
  vat_code: string;
  vat_name: string;
  percentage: string;
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
  },
};

const schema = yup.object().shape({
  vat_code: yup.string().required("VAT code is required"),
  vat_name: yup.string().required("VAT name is required"),
  percentage: yup
    .string()
    .required("Percentage is required")
    .matches(/^\d+(\.\d{1,2})?$/, "Enter a valid percentage"),
});

export default function VatMasterCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData =
    (location.state as VatMasterFormData & { id?: number }) || null;
  const isEditMode = !!editData?.id;

  useEffect(() => {
    if (isIndiaUser) {
      navigate("/master", { replace: true });
    }
  }, [isIndiaUser, navigate]);

  const form = useForm<VatMasterFormData>({
    initialValues: {
      vat_code: "",
      vat_name: "",
      percentage: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        vat_code: editData.vat_code || "",
        vat_name: editData.vat_name || "",
        percentage:
          editData.percentage != null ? String(editData.percentage) : "",
        status: editData.status || "ACTIVE",
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: VatMasterFormData) => {
    setIsSubmitting(true);

    try {
      const payload = {
        vat_code: values.vat_code.trim(),
        vat_name: values.vat_name.trim(),
        percentage: Number(values.percentage).toFixed(2),
      };

      if (isEditMode && editData?.id != null) {
        await putAPICall(
          URL.vatMaster,
          {
            ...payload,
            id: editData.id,
            status: values.status || "ACTIVE",
          },
          API_HEADER,
        );
        ToastNotification({
          type: "success",
          message: "VAT Master updated successfully",
        });
      } else {
        await postAPICall(URL.vatMaster, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "VAT Master created successfully",
        });
      }

      navigate("/master/vat-master");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} VAT Master: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/vat-master");
  };

  if (isIndiaUser) {
    return null;
  }

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
              <Text
                size="md"
                fw={600}
                c="#105476"
                style={{
                  fontFamily: "Inter",
                  fontSize: "16px",
                  color: "#105476",
                  textAlign: "center",
                }}
              >
                {isEditMode ? "Edit VAT Master" : "Create VAT Master"}
              </Text>
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
                    label="VAT Code"
                    placeholder="Enter VAT code"
                    withAsterisk
                    {...form.getInputProps("vat_code")}
                    styles={fieldStyles}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <TextInput
                    label="VAT Name"
                    placeholder="Enter VAT name"
                    withAsterisk
                    {...form.getInputProps("vat_name")}
                    styles={fieldStyles}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <NumberInput
                    label="Percentage"
                    placeholder="Enter percentage"
                    withAsterisk
                    value={
                      form.values.percentage === ""
                        ? ""
                        : Number(form.values.percentage)
                    }
                    onChange={(value) =>
                      form.setFieldValue(
                        "percentage",
                        value === "" || value == null ? "" : String(value),
                      )
                    }
                    min={0}
                    max={100}
                    decimalScale={2}
                    fixedDecimalScale={false}
                    hideControls
                    error={form.errors.percentage}
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
                    },
                  }}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: "#105476",
                    fontSize: "13px",
                    fontFamily: "Inter",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                  rightSection={<IconCheck size={16} />}
                >
                  {isEditMode ? "Update" : "Create"}
                </Button>
              </Group>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}
