import { useEffect, useState } from "react";
import { Box, Button, Flex, Grid, Group, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { ToastNotification, SearchableSelect } from "../../../components";
import { URL } from "../../../api/serverUrls";
import useAuthStore from "../../../store/authStore";
import { isIndianUserFromProfile } from "../../../utils/userNumberFormat";

type VatChargeMappingFormData = {
  service_id: string;
  charge_id: string;
  vat_id: string;
};

type EditState = VatChargeMappingFormData & {
  id?: number;
  service_name?: string;
  charge_name?: string;
  vat_code?: string;
  vat_name?: string;
};

const commonLabelStyles = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#424242",
  marginBottom: "4px",
  fontFamily: "Inter",
  fontStyle: "medium",
};

const commonInputStyles = {
  input: {
    fontSize: "13px",
    fontFamily: "Inter",
  },
  label: commonLabelStyles,
};

const schema = yup.object().shape({
  service_id: yup.string().required("Service name is required"),
  charge_id: yup.string().required("Charge name is required"),
  vat_id: yup.string().required("VAT is required"),
});

export default function VatChargeMappingCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData = (location.state as EditState) || null;
  const isEditMode = !!editData?.id;

  useEffect(() => {
    if (isIndiaUser) {
      navigate("/master", { replace: true });
    }
  }, [isIndiaUser, navigate]);

  const form = useForm<VatChargeMappingFormData>({
    initialValues: {
      service_id: "",
      charge_id: "",
      vat_id: "",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      const toStr = (v: number | string | undefined) =>
        v != null ? String(v) : "";
      form.setValues({
        service_id: toStr(editData.service_id),
        charge_id: toStr(editData.charge_id),
        vat_id: toStr(editData.vat_id),
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: VatChargeMappingFormData) => {
    setIsSubmitting(true);

    try {
      const payload = {
        service_id: Number(values.service_id) || 0,
        charge_id: Number(values.charge_id) || 0,
        vat_id: Number(values.vat_id) || 0,
      };

      if (isEditMode && editData?.id != null) {
        await putAPICall(
          URL.vatChargeMapping,
          { ...payload, id: editData.id },
          API_HEADER,
        );
        ToastNotification({
          type: "success",
          message: "VAT Charge Mapping updated successfully",
        });
      } else {
        await postAPICall(URL.vatChargeMapping, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "VAT Charge Mapping created successfully",
        });
      }

      navigate("/master/vat-charge-mapping");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${
          isEditMode ? "updating" : "creating"
        } VAT Charge Mapping: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/vat-charge-mapping");
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
                {isEditMode
                  ? "Edit VAT Charge Mapping"
                  : "Create VAT Charge Mapping"}
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
                  <SearchableSelect
                    label="Service Name"
                    placeholder="Search service..."
                    apiEndpoint={URL.serviceMaster}
                    searchFields={["service_name", "service_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id ?? ""),
                      label: String(item.service_name ?? ""),
                    })}
                    value={form.values.service_id}
                    displayValue={
                      form.values.service_id ? editData?.service_name : undefined
                    }
                    onChange={(value) =>
                      form.setFieldValue("service_id", value ?? "")
                    }
                    minSearchLength={1}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.service_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Charge Name"
                    placeholder="Search charge..."
                    apiEndpoint={URL.chargeMaster}
                    searchFields={["charge_name", "charge_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id ?? ""),
                      label: String(item.charge_name ?? ""),
                    })}
                    value={form.values.charge_id}
                    displayValue={
                      form.values.charge_id ? editData?.charge_name : undefined
                    }
                    onChange={(value) =>
                      form.setFieldValue("charge_id", value ?? "")
                    }
                    minSearchLength={1}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.charge_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="VAT"
                    placeholder="Search VAT code..."
                    apiEndpoint={URL.vatMaster}
                    searchFields={["vat_code", "vat_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id ?? ""),
                      label: String(item.vat_code ?? ""),
                    })}
                    value={form.values.vat_id}
                    displayValue={
                      form.values.vat_id
                        ? editData?.vat_code || editData?.vat_name
                        : undefined
                    }
                    onChange={(value) =>
                      form.setFieldValue("vat_id", value ?? "")
                    }
                    minSearchLength={1}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.vat_id}
                  />
                </Grid.Col>
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
