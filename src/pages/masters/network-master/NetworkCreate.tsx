import { useEffect, useState } from "react";
import {
  Box,
  Button,
  FileInput,
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
import { postAPICall } from "../../../service/postApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { ToastNotification } from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";

type NetworkFormData = {
  network_name: string;
  website: string;
  network_logo: File | null;
};

const schema = yup.object().shape({
  network_name: yup.string().required("Network name is required"),
  website: yup.string().url("Enter a valid URL").required("Website is required"),
  network_logo: yup.mixed().nullable(),
});

type EditState = NetworkFormData & {
  id?: number;
  logo_url?: string;
  network_logo?: string;
};

export default function NetworkCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editData = (location.state as EditState) || null;
  const isEditMode = !!editData?.id;
  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode ? (editData as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode ? URL.networkMaster : undefined,
        recordId: editData?.id,
        enabled: isEditMode,
      },
    );

  const form = useForm<NetworkFormData>({
    initialValues: {
      network_name: "",
      website: "",
      network_logo: null,
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    if (isEditMode && editData) {
      form.setValues({
        network_name: editData.network_name || "",
        website: editData.website || "",
        network_logo: null,
      });
    }
  }, [isEditMode, editData]);

  const handleSubmit = async (values: NetworkFormData) => {
    setIsSubmitting(true);
    try {
      const hasFile = values.network_logo instanceof File;

      if (hasFile) {
        const formData = new FormData();
        formData.append("network_name", values.network_name);
        formData.append("website", values.website);
        formData.append("network_logo", values.network_logo as File);

        if (isEditMode && editData?.id) {
          const res = await apiCallProtected.put(
            `${URL.networkMaster}${editData.id}/`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
                ...API_HEADER.headers,
              },
            }
          );
          applyAuditFromResponse(res);
          await refreshAuditFromDetail(editData.id);
          ToastNotification({ type: "success", message: "Network updated successfully" });
        } else {
          await apiCallProtected.post(URL.networkMaster, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
              ...API_HEADER.headers,
            },
          });
          ToastNotification({ type: "success", message: "Network created successfully" });
        }
      } else {
        const payload = {
          network_name: values.network_name,
          website: values.website,
        };
        if (isEditMode && editData?.id) {
          const res = await apiCallProtected.put(
            `${URL.networkMaster}${editData.id}/`,
            payload,
            { headers: API_HEADER.headers }
          );
          applyAuditFromResponse(res);
          await refreshAuditFromDetail(editData.id);
          ToastNotification({ type: "success", message: "Network updated successfully" });
        } else {
          await postAPICall(URL.networkMaster, payload, API_HEADER);
          ToastNotification({ type: "success", message: "Network created successfully" });
        }
      }

      navigate("/master/network-master", { state: { refreshData: true } });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} network: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/master/network-master");
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
                  {isEditMode ? "Edit Network" : "Create Network"}
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
              <Grid style={{ backgroundColor: "#FFFFFF", height: "100%", borderRadius: "8px", padding: "24px" }}>
                <Grid.Col span={6}>
                  <TextInput
                    label="Network Name"
                    placeholder="Enter network name"
                    withAsterisk
                    {...form.getInputProps("network_name")}
                    styles={{
                      input: { fontSize: "13px", fontFamily: "Inter" },
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
                    label="Website"
                    placeholder="https://example.com"
                    withAsterisk
                    {...form.getInputProps("website")}
                    styles={{
                      input: { fontSize: "13px", fontFamily: "Inter" },
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
                  <FileInput
                    label="Network Logo"
                    placeholder="Choose image file"
                    accept="image/*"
                    clearable
                    {...form.getInputProps("network_logo")}
                    styles={{
                      input: { fontSize: "13px", fontFamily: "Inter" },
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
                  {isEditMode && editData?.logo_url && !form.values.network_logo && (
                    <Group gap="lg" mt={40}>
                      <Text size="xs" c="dimmed">Current logo:</Text>
                      <Box component="img" src={editData.logo_url} alt="" style={{ maxHeight: 100, maxWidth:150 }} />
                    </Group>
                  )}
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
