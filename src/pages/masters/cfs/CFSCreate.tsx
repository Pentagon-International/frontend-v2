import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  Group,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useQuery } from "@tanstack/react-query";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { ToastNotification, SearchableSelect } from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { URL } from "../../../api/serverUrls";

type CFSFormData = {
  cfs_name: string;
  port_id: string;
  port_name: string;
  city_id: string;
  city_name: string;
  state_id: string;
  state_name: string;
  country_id: string;
  country_code: string;
  country_name: string;
  address: string;
  phone: string;
};

const commonLabelStyles = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#424242",
  marginBottom: "4px",
  fontFamily: "Inter",
  fontStyle: "medium",
} as const;

const commonInputStyles = {
  input: { fontSize: "13px", fontFamily: "Inter" },
  label: commonLabelStyles,
};

const schema = yup.object().shape({
  cfs_name: yup.string().required("CFS name is required"),
  port_id: yup.string().required("Port is required"),
  city_id: yup.string().required("City is required"),
  state_id: yup.string().required("State is required"),
  country_id: yup.string().required("Country is required"),
  address: yup.string().required("Address is required"),
  phone: yup.string().required("Phone is required"),
});

export default function CFSCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const seaTransportParams = useMemo(() => ({ transport_mode: "SEA" }), []);

  type EditState = {
    id?: number;
    cfs_name?: string;
    port_id?: number;
    port_name?: string;
    city_id?: number;
    city_name?: string;
    state_id?: number;
    state_name?: string;
    country_id?: number;
    country_name?: string;
    address?: string;
    phone?: string;
  };
  const editData: EditState | null = (location.state as EditState) || null;
  const isEditMode = !!editData?.id;
  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.cfsMaster : undefined,
        recordId: editData?.id,
        enabled: isEditMode,
      },
    );

  const form = useForm<CFSFormData>({
    initialValues: {
      cfs_name: "",
      port_id: "",
      port_name: "",
      city_id: "",
      city_name: "",
      state_id: "",
      state_name: "",
      country_id: "",
      country_code: "",
      country_name: "",
      address: "",
      phone: "",
    },
    validate: yupResolver(schema),
  });

  const { data: countriesData } = useQuery({
    queryKey: ["countries-cfs-edit"],
    queryFn: async () => {
      const res = await getAPICall(URL.country, API_HEADER) as { success?: boolean; data?: { id: number; country_code: string }[] };
      return res?.data ?? [];
    },
    enabled: isEditMode && !!editData?.country_id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        cfs_name: editData.cfs_name ?? "",
        port_id: editData.port_id != null ? String(editData.port_id) : "",
        port_name: editData.port_name ?? "",
        city_id: editData.city_id != null ? String(editData.city_id) : "",
        city_name: editData.city_name ?? "",
        state_id: editData.state_id != null ? String(editData.state_id) : "",
        state_name: editData.state_name ?? "",
        country_id: editData.country_id != null ? String(editData.country_id) : "",
        country_name: editData.country_name ?? "",
        country_code: "",
        address: editData.address ?? "",
        phone: editData.phone ?? "",
      });
    }
  }, [isEditMode, editData?.id]);

  useEffect(() => {
    if (!isEditMode || !editData?.country_id || !countriesData?.length) return;
    const country = countriesData.find((c) => c.id === Number(editData!.country_id));
    if (country?.country_code) {
      form.setFieldValue("country_code", country.country_code);
    }
  }, [isEditMode, editData?.country_id, countriesData, form]);

  const handleSubmit = async (values: CFSFormData) => {
    setIsSubmitting(true);
    const payload = {
      cfs_name: values.cfs_name,
      port_id: parseInt(values.port_id, 10),
      city_id: parseInt(values.city_id, 10),
      state_id: parseInt(values.state_id, 10),
      country_id: parseInt(values.country_id, 10),
      address: values.address,
      phone: values.phone,
    };

    try {
      if (isEditMode && editData?.id) {
        const res = await putAPICall(
          URL.cfsMaster,
          { ...payload, id: editData.id },
          API_HEADER,
        );
        applyAuditFromResponse(res);
        await refreshAuditFromDetail(editData.id);
        ToastNotification({ type: "success", message: "CFS updated successfully" });
      } else {
        await postAPICall(URL.cfsMaster, payload, API_HEADER);
        ToastNotification({ type: "success", message: "CFS created successfully" });
      }
      navigate("/master/cfs-master", { state: { refreshData: true } });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} CFS: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/cfs-master");
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
                  {isEditMode ? "Edit CFS" : "Create CFS"}
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
                    label="CFS Name"
                    placeholder="Enter CFS name"
                    withAsterisk
                    {...form.getInputProps("cfs_name")}
                    styles={commonInputStyles}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Port"
                    placeholder="Type port name"
                    withAsterisk
                    apiEndpoint={URL.portMaster}
                    value={form.values.port_id}
                    displayValue={form.values.port_name || undefined}
                    onChange={(val, selectedData) => {
                      form.setFieldValue("port_id", val ?? "");
                      form.setFieldValue("port_name", selectedData?.label ?? "");
                    }}
                    dropdownZIndex={1000}
                    minSearchLength={1}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String((item as { id?: number }).id ?? ""),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    searchFields={["port_name", "port_code"]}
                    size="sm"
                    styles={commonInputStyles}
                    additionalParams={seaTransportParams}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="Country"
                    placeholder="Type country name"
                    withAsterisk
                    apiEndpoint={URL.country}
                    value={form.values.country_id}
                    displayValue={form.values.country_name || undefined}
                    returnOriginalData
                    onChange={(val, selectedData, originalData) => {
                      if (val == null) {
                        form.setFieldValue("country_id", "");
                        form.setFieldValue("country_name", "");
                        form.setFieldValue("country_code", "");
                        form.setFieldValue("state_id", "");
                        form.setFieldValue("state_name", "");
                        return;
                      }
                      form.setFieldValue("country_id", val ?? "");
                      form.setFieldValue("country_name", selectedData?.label ?? "");
                      form.setFieldValue(
                        "country_code",
                        (originalData as { country_code?: string } | null)?.country_code ?? "",
                      );
                      form.setFieldValue("state_id", "");
                      form.setFieldValue("state_name", "");
                    }}
                    dropdownZIndex={1000}
                    minSearchLength={1}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String((item as { id?: number }).id ?? ""),
                      label: String((item as { country_name?: string }).country_name ?? ""),
                    })}
                    searchFields={["country_name"]}
                    size="sm"
                    styles={commonInputStyles}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="State"
                    placeholder="Type state name"
                    withAsterisk
                    apiEndpoint={URL.state}
                    value={form.values.state_id}
                    displayValue={form.values.state_name || undefined}
                    disabled={!form.values.country_code}
                    additionalParams={
                      form.values.country_code
                        ? { country_code: form.values.country_code }
                        : undefined
                    }
                    onChange={(val, selectedData) => {
                      form.setFieldValue("state_id", val ?? "");
                      form.setFieldValue("state_name", selectedData?.label ?? "");
                    }}
                    dropdownZIndex={1000}
                    minSearchLength={1}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String((item as { id?: number }).id ?? ""),
                      label: String((item as { state_name?: string }).state_name ?? ""),
                    })}
                    searchFields={["state_name"]}
                    size="sm"
                    styles={commonInputStyles}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <SearchableSelect
                    label="City"
                    placeholder="Type city name"
                    withAsterisk
                    apiEndpoint={URL.city}
                    value={form.values.city_id}
                    displayValue={form.values.city_name || undefined}
                    onChange={(val, selectedData) => {
                      form.setFieldValue("city_id", val ?? "");
                      form.setFieldValue("city_name", selectedData?.label ?? "");
                    }}
                    dropdownZIndex={1000}
                    minSearchLength={1}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String((item as { id?: number }).id ?? ""),
                      label: String((item as { city_name?: string }).city_name ?? ""),
                    })}
                    searchFields={["city_name"]}
                    size="sm"
                    styles={commonInputStyles}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Address"
                    placeholder="Enter address"
                    withAsterisk
                    {...form.getInputProps("address")}
                    styles={commonInputStyles}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Phone"
                    placeholder="Enter phone"
                    withAsterisk
                    {...form.getInputProps("phone")}
                    styles={commonInputStyles}
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
