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
import {
  ToastNotification,
  SearchableSelect,
  SingleDateInput,
} from "../../../components";
import { URL } from "../../../api/serverUrls";

type GSTChargeMappingFormData = {
  service_id: string;
  charge_id: string;
  sac_id: string;
  effective_from: Date | null;
};

type EditState = GSTChargeMappingFormData & {
  id?: number;
  service_name?: string;
  charge_name?: string;
  sac_name?: string;
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
  sac_id: yup.string().required("SAC name is required"),
  effective_from: yup.date().nullable().required("Effective from is required"),
});

const formatDateToYYYYMMDD = (date: Date | null): string | undefined => {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function GSTChargeMappingCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData = (location.state as EditState) || null;
  const isEditMode = !!editData?.id;

  const form = useForm<GSTChargeMappingFormData>({
    initialValues: {
      service_id: "",
      charge_id: "",
      sac_id: "",
      effective_from: null,
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      const toStr = (v: number | string | undefined) =>
        v != null ? String(v) : "";
      let effFrom: Date | null = null;
      if (editData.effective_from) {
        const val = editData.effective_from;
        effFrom =
          val instanceof Date
            ? val
            : new Date(typeof val === "string" ? val : "");
        if (isNaN(effFrom.getTime())) effFrom = null;
      }
      form.setValues({
        service_id: toStr(editData.service_id),
        charge_id: toStr(editData.charge_id),
        sac_id: toStr(editData.sac_id),
        effective_from: effFrom,
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: GSTChargeMappingFormData) => {
    setIsSubmitting(true);

    try {
      const effFrom = formatDateToYYYYMMDD(values.effective_from);
      const payload = {
        service_id: Number(values.service_id) || 0,
        charge_id: Number(values.charge_id) || 0,
        sac_id: Number(values.sac_id) || 0,
        effective_from: effFrom || "",
      };

      if (isEditMode && editData?.id != null) {
        await putAPICall(
          URL.gstChargeMapping,
          { ...payload, id: editData.id },
          API_HEADER
        );
        ToastNotification({
          type: "success",
          message: "GST Charge Mapping updated successfully",
        });
      } else {
        await postAPICall(URL.gstChargeMapping, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "GST Charge Mapping created successfully",
        });
      }

      navigate("/master/gst-charge-mapping");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${
          isEditMode ? "updating" : "creating"
        } GST Charge Mapping: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/gst-charge-mapping");
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
                c="#105476"
                style={{
                  fontFamily: "Inter",
                  fontStyle: "medium",
                  fontSize: "16px",
                  color: "#105476",
                  textAlign: "center",
                }}
              >
                {isEditMode
                  ? "Edit GST Charge Mapping"
                  : "Create GST Charge Mapping"}
              </Text>
            </Box>
          </Box>

          {/* Main Content Area */}
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
                      form.values.service_id
                        ? editData?.service_name
                        : undefined
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
                    label="SAC Name"
                    placeholder="Search SAC..."
                    apiEndpoint={URL.gstSacMaster}
                    searchFields={["sac_name", "sac_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id ?? ""),
                      label: String(item.sac_name ?? ""),
                    })}
                    value={form.values.sac_id}
                    displayValue={
                      form.values.sac_id ? editData?.sac_name : undefined
                    }
                    onChange={(value) =>
                      form.setFieldValue("sac_id", value ?? "")
                    }
                    minSearchLength={1}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.sac_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SingleDateInput
                    label="Effective From"
                    placeholder="Select date"
                    value={form.values.effective_from}
                    onChange={(date) =>
                      form.setFieldValue("effective_from", date)
                    }
                    size="sm"
                    withAsterisk
                    error={form.errors.effective_from as string}
                  />
                </Grid.Col>
              </Grid>
            </Box>

            {/* Footer Buttons */}
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
