import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { toTitleCase } from "../../../utils/textFormatter";

type ServiceForm = {
  service_code: string;
  service_name: string;
  transport_mode: string;
  full_groupage: string;
  import_export: string;
};

function ServiceMasterNew() {
  const navigate = useNavigate();
  const [transportModes, setTransportModes] = useState<
    { label: string; value: string }[]
  >([]);

  // ✅ Fetch transport modes from PortMaster (distinct ACTIVE only)
  useEffect(() => {
    const fetchTransportModes = async () => {
      try {
        const res = await getAPICall(URL.portMaster, API_HEADER);
        const activePorts = res.filter((port: any) => port.status === "ACTIVE");
        const uniqueModes = Array.from(
          new Set(activePorts.map((port: any) => port.transport_mode))
        );
        const formattedModes = uniqueModes.map((mode) => ({
          label: mode,
          value: mode,
        }));
        setTransportModes(formattedModes);
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
  });

  const form = useForm<ServiceForm>({
    initialValues: {
      service_code: "",
      service_name: "",
      transport_mode: "",
      full_groupage: "",
      import_export: "",
    },
    validate: yupResolver(schema),
  });

  const handleCreateForm = async (values: ServiceForm) => {
    try {
      const payload = {
        ...values,
        status: "ACTIVE",
      };
      await postAPICall(URL.serviceMaster, payload, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Service created successfully",
      });
      navigate("/master/service");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while creating service: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={form.onSubmit(handleCreateForm)}
    >
      <Text fw={500} my="md">
        Create Service
      </Text>

      <Group grow mb="md">
        <TextInput
          label="Service Code"
          withAsterisk
          {...form.getInputProps("service_code")}
        />
        <TextInput
          label="Service Name"
          withAsterisk
          value={form.values.service_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            form.setFieldValue("service_name", formattedValue);
          }}
          error={form.errors.service_name}
        />
      </Group>

      <Group grow mb="md">
        <Select
          label="Transport Mode"
          withAsterisk
          data={transportModes}
          searchable
          {...form.getInputProps("transport_mode")}
        />
        <TextInput
          label="Full/Groupage"
          withAsterisk
          value={form.values.full_groupage}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            form.setFieldValue("full_groupage", formattedValue);
          }}
          error={form.errors.full_groupage}
        />
        <TextInput
          label="Import/Export"
          withAsterisk
          value={form.values.import_export}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            form.setFieldValue("import_export", formattedValue);
          }}
          error={form.errors.import_export}
        />
      </Group>

      <Stack justify="space-between" mt="40%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/service")}
          >
            Back
          </Button>
          <Flex gap="md">
            <Button
              variant="outline"
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              onClick={() => navigate("/master/service")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="#105476"
              rightSection={<IconCheck size={16} />}
            >
              Submit
            </Button>
          </Flex>
        </Flex>
      </Stack>
    </Box>
  );
}

export default ServiceMasterNew;
