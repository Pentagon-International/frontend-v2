import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Center,
  Flex,
  Grid,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconCheck,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import MasterAuditHeadingRow from "../../../components/MasterAuditHeadingRow";
import { useMasterEditAuditRefresh } from "../../../hooks/useMasterEditAuditRefresh";
import { postAPICall } from "../../../service/postApiCall";
import { putAPICall } from "../../../service/putApiCall";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery } from "@tanstack/react-query";
import { toTitleCase } from "../../../utils/textFormatter";
import { useListFilterStore } from "../../../store/listFilterStore";

const LIST_KEY = "PORT_MASTER";
const BASE_PATH = "/master/port";

type CountryData = {
  country_code: string;
  country_name: string;
  status: string;
};

type CountryApiResponse = {
  success?: boolean;
  data?: CountryData[];
};

type PortRecord = {
  id?: number;
  port_code?: string;
  port_name?: string;
  transport_mode?: string;
  country?: string;
  country_code?: string;
  country_name?: string;
  status?: "ACTIVE" | "INACTIVE";
};

type PortFormData = {
  port_code: string;
  port_name: string;
  transport_mode: string;
  country_code: string;
  country_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const commonLabelStyles = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#424242",
  marginBottom: "4px",
  fontFamily: "Inter",
} as const;

const commonInputStyles = {
  input: { fontSize: "13px", fontFamily: "Inter" },
  label: commonLabelStyles,
};

const TRANSPORT_OPTIONS = [
  { value: "AIR", label: "AIR" },
  { value: "SEA", label: "SEA" },
];

const schema = yup.object().shape({
  port_code: yup.string().required("Port Code is required"),
  port_name: yup.string().required("Port Name is required"),
  transport_mode: yup.string().required("Transport Mode is required"),
  country_code: yup.string().required("Country is required"),
});

function buildApiPayload(values: PortFormData, id?: number) {
  const payload: Record<string, unknown> = {
    port_code: values.port_code,
    port_name: values.port_name,
    transport_mode: values.transport_mode,
    country: values.country_code,
    status: values.status,
  };
  if (id != null) payload.id = id;
  return payload;
}

export default function PortCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const isViewMode = location.pathname.endsWith("/view");
  const isEditMode = location.pathname.endsWith("/edit");
  const isCreateMode = !isViewMode && !isEditMode;

  const record = (location.state as PortRecord | undefined) ?? undefined;
  const { auditSource, applyAuditFromResponse, refreshAuditFromDetail } =
    useMasterEditAuditRefresh(
      isEditMode || isViewMode ? (record as Record<string, unknown>) : null,
      {
        detailBaseUrl: isEditMode || isViewMode ? URL.portMaster : undefined,
        recordId: record?.id,
        enabled: isEditMode || isViewMode,
      },
    );

  const { data: countries = [] } = useQuery({
    queryKey: ["countries-port-create"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          URL.country,
          API_HEADER,
        )) as CountryApiResponse | CountryData[];
        if (
          response &&
          typeof response === "object" &&
          "success" in response &&
          response.success &&
          Array.isArray(response.data)
        ) {
          return response.data;
        }
        if (Array.isArray(response)) return response;
        return [];
      } catch (error) {
        console.error("Error fetching countries:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const countryOptions = useMemo(
    () =>
      countries
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({
          value: c.country_code,
          label: c.country_name,
        })),
    [countries],
  );

  const form = useForm<PortFormData>({
    initialValues: {
      port_code: "",
      port_name: "",
      transport_mode: "",
      country_code: "",
      country_name: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  const pageTitle = useMemo(() => {
    if (isViewMode) return "View Port";
    if (isEditMode) return "Edit Port";
    return "Create Port";
  }, [isViewMode, isEditMode]);

  useEffect(() => {
    if (!isCreateMode && record) {
      form.setValues({
        port_code: record.port_code ?? "",
        port_name: record.port_name ?? "",
        transport_mode: record.transport_mode ?? "",
        country_code: record.country_code ?? record.country ?? "",
        country_name: record.country_name ?? record.country ?? "",
        status: record.status ?? "INACTIVE",
      });
    }
  }, [isCreateMode, record]);

  const handleSubmit = async (values: PortFormData) => {
    setIsSubmitting(true);
    try {
      const payload = buildApiPayload(values, record?.id);
      if (isEditMode) {
        const res = await putAPICall(URL.portMaster, payload, API_HEADER);
        applyAuditFromResponse(res);
        await refreshAuditFromDetail(record?.id);
        ToastNotification({
          type: "success",
          message: "Port updated successfully",
        });
      } else {
        await postAPICall(URL.portMaster, payload, API_HEADER);
        ToastNotification({
          type: "success",
          message: "Port created successfully",
        });
      }
      navigate(BASE_PATH, { state: { refreshData: true } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error ${isEditMode ? "updating" : "creating"} port: ${message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!record?.id) return;
    try {
      setIsDeleting(true);
      await deleteApiCall(URL.portMaster, API_HEADER, record);
      ToastNotification({
        type: "success",
        message: "Port deleted successfully",
      });
      closeDeleteModal();
      navigate(BASE_PATH);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      ToastNotification({
        type: "error",
        message: `Error while deleting port: ${message}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const goToEdit = () => {
    setShouldRestore(LIST_KEY, true);
    navigate(`${BASE_PATH}/edit`, { state: record });
  };

  if (!isCreateMode && !record) {
    return (
      <Center py="xl">
        <Text size="sm" c="dimmed">
          No port data available.
        </Text>
      </Center>
    );
  }

  return (
    <Box
      component={isViewMode ? "div" : "form"}
      onSubmit={isViewMode ? undefined : form.onSubmit(handleSubmit)}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        height: "100%",
      }}
    >
      <Card
        shadow="sm"
        padding="sm"
        pb="sm"
        radius="md"
        withBorder
        mt="md"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          height: "calc(100vh - 112px)",
          overflow: "hidden",
          backgroundColor: "#F8F8F8",
        }}
      >
        <Flex
          gap="md"
          align="stretch"
          style={{
            flex: 1,
            minHeight: 0,
            height: "100%",
            width: "100%",
          }}
        >
          <Box
            style={{
              minWidth: 180,
              width: "100%",
              maxWidth: 220,
              flexShrink: 0,
              alignSelf: "stretch",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
            }}
          >
            <Box
              style={{
                height: "100%",
                padding: "20px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
              }}
            >
              <MasterAuditHeadingRow
                auditSource={auditSource}
                visible={isEditMode || isViewMode}
                justify="center"
              >
                <Text
                  size="md"
                  fw={600}
                  c="#105476"
                  style={{
                    fontFamily: "Inter",
                    fontSize: "16px",
                    textAlign: "center",
                  }}
                >
                  {pageTitle}
                </Text>
              </MasterAuditHeadingRow>
            </Box>
          </Box>

          <Box
            style={{
              flex: 1,
              minHeight: 0,
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Box
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                paddingBottom: "8px",
                backgroundColor: "#F8F8F8",
              }}
            >
              {(isEditMode || isViewMode) && (
                <Group justify="flex-end" mb="md" px="md" pt="md" gap="md">
                  <SegmentedControl
                    size="xs"
                    radius="sm"
                    readOnly={isViewMode}
                    data={[
                      { label: "Active", value: "ACTIVE" },
                      { label: "Inactive", value: "INACTIVE" },
                    ]}
                    {...form.getInputProps("status")}
                    styles={{
                      root: {
                        backgroundColor: "#E4E4E4",
                        color: "#105476",
                        width: "150px",
                      },
                      indicator: { backgroundColor: "#105476" },
                      label: {
                        color: "#105476",
                        "&[data-active]": { color: "#ffffff" },
                      },
                    }}
                  />
                  {isViewMode && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftSection={<IconEdit size={16} />}
                      styles={{
                        root: {
                          borderColor: "#105476",
                          color: "#105476",
                          fontSize: "13px",
                          fontFamily: "Inter",
                        },
                      }}
                      onClick={goToEdit}
                    >
                      Edit
                    </Button>
                  )}
                </Group>
              )}

              <Grid
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "8px",
                  padding: "24px",
                  margin: isCreateMode ? "0" : "0 0 8px 0",
                }}
              >
                <Grid.Col span={6}>
                  <TextInput
                    label="Port Code"
                    placeholder="Enter port code"
                    withAsterisk
                    readOnly={isViewMode}
                    {...form.getInputProps("port_code")}
                    styles={commonInputStyles}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Port Name"
                    placeholder="Enter port name"
                    withAsterisk
                    readOnly={isViewMode}
                    value={form.values.port_name}
                    onChange={(e) => {
                      if (isViewMode) return;
                      form.setFieldValue(
                        "port_name",
                        toTitleCase(e.target.value),
                      );
                    }}
                    error={form.errors.port_name}
                    styles={commonInputStyles}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  {isViewMode ? (
                    <TextInput
                      label="Transport Mode"
                      withAsterisk
                      readOnly
                      value={form.values.transport_mode}
                      styles={commonInputStyles}
                    />
                  ) : (
                    <Select
                      label="Transport Mode"
                      placeholder="Select transport mode"
                      withAsterisk
                      data={TRANSPORT_OPTIONS}
                      {...form.getInputProps("transport_mode")}
                      styles={commonInputStyles}
                    />
                  )}
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Country"
                    placeholder="Select country"
                    withAsterisk
                    searchable
                    data={countryOptions}
                    disabled={isViewMode}
                    value={form.values.country_code || null}
                    onChange={(value) => {
                      if (isViewMode) return;
                      if (!value) {
                        form.setFieldValue("country_code", "");
                        form.setFieldValue("country_name", "");
                        return;
                      }
                      const selected = countryOptions.find(
                        (o) => o.value === value,
                      );
                      form.setFieldValue("country_code", value);
                      form.setFieldValue(
                        "country_name",
                        selected?.label ?? "",
                      );
                    }}
                    error={form.errors.country_code}
                    styles={commonInputStyles}
                  />
                </Grid.Col>
              </Grid>
            </Box>

            <Box
              style={{
                flexShrink: 0,
                borderTop: "1px solid #e9ecef",
                borderRadius: "8px",
                padding: "20px 32px",
                backgroundColor: "#ffffff",
              }}
            >
              <Group justify="space-between">
                <Group gap="sm">
                  {isViewMode ? (
                    <Button
                      variant="outline"
                      size="sm"
                      leftSection={<IconTrash size={16} />}
                      onClick={openDeleteModal}
                      styles={{
                        root: {
                          borderColor: "red",
                          color: "red",
                          fontSize: "13px",
                          fontFamily: "Inter",
                        },
                      }}
                    >
                      Delete
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      color="gray"
                      size="sm"
                      leftSection={<IconArrowLeft size={16} />}
                      styles={{
                        root: {
                          borderColor: "#d0d0d0",
                          color: "#666",
                          fontSize: "13px",
                          fontFamily: "Inter",
                        },
                      }}
                      onClick={() => navigate(BASE_PATH)}
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                  )}
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
                    onClick={() => navigate(BASE_PATH)}
                    disabled={isSubmitting}
                  >
                    {isViewMode ? "Back to List" : "Cancel"}
                  </Button>
                </Group>

                {!isViewMode && (
                  <Button
                    type="submit"
                    size="sm"
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    style={{
                      backgroundColor: "#105476",
                      fontSize: "13px",
                      fontFamily: "Inter",
                    }}
                    rightSection={<IconCheck size={16} />}
                  >
                    {isEditMode ? "Update" : "Create"}
                  </Button>
                )}
              </Group>
            </Box>
          </Box>
        </Flex>
      </Card>

      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Confirm Delete"
        centered
        size="sm"
        closeOnClickOutside={false}
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure? Do you want to delete this port?
          </Text>
          {record?.port_code || record?.port_name ? (
            <Box p="xs" bg="#f8f9fa" style={{ borderRadius: "4px" }}>
              <Text size="xs" c="dimmed">
                {record.port_code ? (
                  <>
                    <Text span fw={500}>
                      Port Code:
                    </Text>{" "}
                    {record.port_code}
                    <br />
                  </>
                ) : null}
                {record.port_name ? (
                  <>
                    <Text span fw={500}>
                      Port Name:
                    </Text>{" "}
                    {record.port_name}
                  </>
                ) : null}
              </Text>
            </Box>
          ) : null}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              color="#105476"
              size="xs"
              onClick={closeDeleteModal}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              color="#FF0004"
              w={100}
              onClick={confirmDelete}
              loading={isDeleting}
              disabled={isDeleting}
            >
              Yes, Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
