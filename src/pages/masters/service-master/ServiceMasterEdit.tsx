import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { putAPICall } from "../../../service/putApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { toTitleCase } from "../../../utils/textFormatter";

type ServiceData = {
  id: number;
  service_code: string;
  service_name: string;
  transport_mode: string;
  full_groupage: string;
  import_export: string;
  status: "ACTIVE" | "INACTIVE";
};

function ServiceMasterEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const editFormData = location.state as ServiceData | undefined;

  const [transportModes, setTransportModes] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    const fetchTransportModes = async () => {
      try {
        const res = await getAPICall(URL.portMaster, API_HEADER);
        const activePorts = res.filter((port: any) => port.status === "ACTIVE");
        const uniqueModes = Array.from(
          new Set(activePorts.map((port: any) => port.transport_mode))
        );
        const modeOptions = uniqueModes.map((mode) => ({
          label: mode,
          value: mode,
        }));
        setTransportModes(modeOptions);
      } catch (err: any) {
        ToastNotification({
          type: "error",
          message: `Error fetching transport modes: ${err.message}`,
        });
      }
    };
    fetchTransportModes();
  }, []);

  const schema = yup.object().shape({
    service_code: yup.string().required("Service Code is required"),
    service_name: yup.string().required("Service Name is required"),
    transport_mode: yup.string().required("Transport Mode is required"),
    full_groupage: yup.string().required("Full/Groupage is required"),
    import_export: yup.string().required("Import/Export is required"),
    status: yup.string().oneOf(["ACTIVE", "INACTIVE"]),
  });

  const editForm = useForm<ServiceData>({
    initialValues: {
      id: editFormData?.id || 0,
      service_code: editFormData?.service_code || "",
      service_name: editFormData?.service_name || "",
      transport_mode: editFormData?.transport_mode || "",
      full_groupage: editFormData?.full_groupage || "",
      import_export: editFormData?.import_export || "",
      status: editFormData?.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleEditForm = async (values: ServiceData): Promise<void> => {
    try {
      await putAPICall(URL.serviceMaster, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Service updated successfully",
      });
      navigate("/master/service");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while updating service: ${err.message}`,
      });
    }
  };

  const handleBack = () => {
    if (editFormData?.from === "view") {
      navigate("/master/service-view", { state: editFormData });
    } else {
      navigate("/master/service");
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "90%", padding: "0 10%" }}
      onSubmit={editForm.onSubmit(handleEditForm)}
    >
      <Group justify="space-between">
        <Text fw={500} my="md">
          Edit Service
        </Text>
        <SegmentedControl
          size="xs"
          radius="sm"
          data={[
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
          {...editForm.getInputProps("status")}
          styles={{
            root: { backgroundColor: "#E4E4E4", width: 150 },
            indicator: { backgroundColor: "#105476" },
            label: {
              color: "#105476",
              "&[data-active]": { color: "#fff" },
            },
          }}
        />
      </Group>

      <Group mb="md" gap={100}>
        <TextInput
          label="Service Code"
          withAsterisk
          w={200}
          {...editForm.getInputProps("service_code")}
        />
        <TextInput
          label="Service Name"
          withAsterisk
          w={200}
          value={editForm.values.service_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            editForm.setFieldValue("service_name", formattedValue);
          }}
          error={editForm.errors.service_name}
        />
      </Group>

      <Group mb="md" gap={100}>
        <Select
          label="Transport Mode"
          withAsterisk
          w={200}
          data={transportModes}
          searchable
          {...editForm.getInputProps("transport_mode")}
        />
        <TextInput
          label="Full/Groupage"
          withAsterisk
          w={200}
          value={editForm.values.full_groupage}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            editForm.setFieldValue("full_groupage", formattedValue);
          }}
          error={editForm.errors.full_groupage}
        />
        <TextInput
          label="Import/Export"
          withAsterisk
          w={200}
          value={editForm.values.import_export}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            editForm.setFieldValue("import_export", formattedValue);
          }}
          error={editForm.errors.import_export}
        />
      </Group>

      <Stack justify="space-between" mt="30%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            w={130}
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={handleBack}
            styles={{
              root: { color: "#105476", borderColor: "#105476" },
            }}
          >
            Back
          </Button>
          <Group>
            <Button
              w={130}
              variant="outline"
              onClick={() => navigate("/master/service")}
              styles={{
                root: { color: "#105476", borderColor: "#105476" },
              }}
            >
              Cancel
            </Button>
            <Button
              w={130}
              type="submit"
              color="#105476"
              rightSection={<IconCheck size={16} />}
            >
              Update
            </Button>
          </Group>
        </Flex>
      </Stack>
    </Box>
  );
}

export default ServiceMasterEdit;
