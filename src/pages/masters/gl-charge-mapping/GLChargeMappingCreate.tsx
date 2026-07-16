import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Group,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { ToastNotification, SearchableSelect } from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { URL } from "../../../api/serverUrls";

type GLChargeMappingFormData = {
  charge_id: string;
  country_id: string;
  service_id: string;
  revenue_gl_id: string;
  cost_gl_id: string;
  neutral_gl_id: string;
  revenue_sl_id: string;
  cost_sl_id: string;
  neutral_sl_id: string;
};

type EditState = GLChargeMappingFormData & {
  id?: number | string;
  charge_name?: string;
  country_name?: string;
  service_name?: string;
  revenue_gl_name?: string;
  cost_gl_name?: string;
  neutral_gl_name?: string;
  revenue_sl_name?: string;
  cost_sl_name?: string;
  neutral_sl_name?: string;
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
  charge_id: yup.string().required("Charge name is required"),
  country_id: yup.string().nullable(),
  service_id: yup.string().required("Service name is required"),
  revenue_gl_id: yup.string().required("Revenue GL name is required"),
  cost_gl_id: yup.string().required("Cost GL name is required"),
  neutral_gl_id: yup.string().required("Neutral GL name is required"),
  revenue_sl_id: yup.string().required("Revenue SL name is required"),
  cost_sl_id: yup.string().required("Cost SL name is required"),
  neutral_sl_id: yup.string().required("Neutral SL name is required"),
});

export default function GLChargeMappingCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData = (location.state as EditState) || null;
  const isEditMode = !!editData?.id;
  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.glChargeMapping : undefined,
        recordId: editData?.id,
        enabled: isEditMode,
      },
    );

  const form = useForm<GLChargeMappingFormData>({
    initialValues: {
      charge_id: "",
      country_id: "",
      service_id: "",
      revenue_gl_id: "",
      cost_gl_id: "",
      neutral_gl_id: "",
      revenue_sl_id: "",
      cost_sl_id: "",
      neutral_sl_id: "",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      const toStr = (v: number | string | undefined) =>
        v != null ? String(v) : "";
      form.setValues({
        charge_id: toStr(editData.charge_id),
        country_id: toStr(editData.country_id),
        service_id: toStr(editData.service_id),
        revenue_gl_id: toStr(editData.revenue_gl_id),
        cost_gl_id: toStr(editData.cost_gl_id),
        neutral_gl_id: toStr(editData.neutral_gl_id),
        revenue_sl_id: toStr(editData.revenue_sl_id),
        cost_sl_id: toStr(editData.cost_sl_id),
        neutral_sl_id: toStr(editData.neutral_sl_id),
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: GLChargeMappingFormData) => {
    setIsSubmitting(true);

    try {
      const payload: Record<string, number | null> = {
        charge_id: Number(values.charge_id) || 0,
        country_id: values.country_id ? Number(values.country_id) : null,
        service_id: Number(values.service_id) || 0,
        revenue_gl_id: Number(values.revenue_gl_id) || 0,
        cost_gl_id: Number(values.cost_gl_id) || 0,
        neutral_gl_id: Number(values.neutral_gl_id) || 0,
        revenue_sl_id: Number(values.revenue_sl_id) || 0,
        cost_sl_id: Number(values.cost_sl_id) || 0,
        neutral_sl_id: Number(values.neutral_sl_id) || 0,
      };

      if (isEditMode && editData?.id != null) {
        const res = await putAPICall(
          URL.glChargeMapping,
          { ...payload, id: editData.id },
          API_HEADER
        );
        applyAuditFromResponse(res);
        await refreshAuditFromDetail(editData.id);
        ToastNotification({
          type: "success",
          message: "GL Charge Mapping updated successfully",
        });
      } else {
        await postAPICall(URL.glChargeMapping, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "GL Charge Mapping created successfully",
        });
      }

      navigate("/master/gl-charge-mapping", { state: { refreshData: true } });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} GL Charge Mapping: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/gl-charge-mapping");
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
                  {isEditMode ? "Edit GL Charge Mapping" : "Create GL Charge Mapping"}
                </Text>
              </MasterAuditHeadingRow>
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
                    label="Charge Name"
                    placeholder="Type charge name"
                    apiEndpoint={`${URL.chargeMaster}`}
                    searchFields={["charge_name", "charge_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.charge_name || ""),
                    })}
                    value={form.values.charge_id}
                    displayValue={form.values.charge_id ? editData?.charge_name : undefined}
                    onChange={(value) => form.setFieldValue("charge_id", value ?? "")}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.charge_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Country Name"
                    placeholder="Type country name"
                    apiEndpoint={`${URL.country}`}
                    searchFields={["country_name", "country_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.country_name || ""),
                    })}
                    value={form.values.country_id || null}
                    displayValue={form.values.country_id ? editData?.country_name : undefined}
                    onChange={(value) => form.setFieldValue("country_id", value ?? "")}
                    minSearchLength={2}
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.country_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Service Name"
                    placeholder="Type service name"
                    apiEndpoint={`${URL.serviceMaster}`}
                    searchFields={["service_name", "service_code"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.service_name || ""),
                    })}
                    value={form.values.service_id}
                    displayValue={form.values.service_id ? editData?.service_name : undefined}
                    onChange={(value) => form.setFieldValue("service_id", value ?? "")}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.service_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Revenue GL Name"
                    placeholder="Type revenue GL name"
                    apiEndpoint={`${URL.chartOfAccounts}`}
                    searchFields={["account_name", "group_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.account_name || item.group_name || ""),
                    })}
                    value={form.values.revenue_gl_id}
                    displayValue={form.values.revenue_gl_id ? editData?.revenue_gl_name : undefined}
                    onChange={(value) => form.setFieldValue("revenue_gl_id", value ?? "")}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.revenue_gl_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Cost GL Name"
                    placeholder="Type cost GL name"
                    apiEndpoint={`${URL.chartOfAccounts}`}
                    searchFields={["account_name", "group_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.account_name || item.group_name || ""),
                    })}
                    value={form.values.cost_gl_id}
                    displayValue={form.values.cost_gl_id ? editData?.cost_gl_name : undefined}
                    onChange={(value) => form.setFieldValue("cost_gl_id", value ?? "")}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.cost_gl_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Neutral GL Name"
                    placeholder="Type neutral GL name"
                    apiEndpoint={`${URL.chartOfAccounts}`}
                    searchFields={["account_name", "group_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.account_name || item.group_name || ""),
                    })}
                    value={form.values.neutral_gl_id}
                    displayValue={form.values.neutral_gl_id ? editData?.neutral_gl_name : undefined}
                    onChange={(value) => form.setFieldValue("neutral_gl_id", value ?? "")}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.neutral_gl_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Revenue SL Name"
                    placeholder="Type revenue SL name"
                    apiEndpoint={`${URL.chartOfAccounts}`}
                    searchFields={["account_name", "group_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.account_name || item.group_name || ""),
                    })}
                    value={form.values.revenue_sl_id}
                    displayValue={form.values.revenue_sl_id ? editData?.revenue_sl_name : undefined}
                    onChange={(value) => form.setFieldValue("revenue_sl_id", value ?? "")}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.revenue_sl_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Cost SL Name"
                    placeholder="Type cost SL name"
                    apiEndpoint={`${URL.chartOfAccounts}`}
                    searchFields={["account_name", "group_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.account_name || item.group_name || ""),
                    })}
                    value={form.values.cost_sl_id}
                    displayValue={form.values.cost_sl_id ? editData?.cost_sl_name : undefined}
                    onChange={(value) => form.setFieldValue("cost_sl_id", value ?? "")}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.cost_sl_id}
                  />
                </Grid.Col>

                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Neutral SL Name"
                    placeholder="Type neutral SL name"
                    apiEndpoint={`${URL.chartOfAccounts}`}
                    searchFields={["account_name", "group_name"]}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.id),
                      label: String(item.account_name || item.group_name || ""),
                    })}
                    value={form.values.neutral_sl_id}
                    displayValue={form.values.neutral_sl_id ? editData?.neutral_sl_name : undefined}
                    onChange={(value) => form.setFieldValue("neutral_sl_id", value ?? "")}
                    minSearchLength={2}
                    withAsterisk
                    dropdownZIndex={100}
                    styles={commonInputStyles}
                    error={form.errors.neutral_sl_id}
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
