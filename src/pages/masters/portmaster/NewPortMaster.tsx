import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification, SearchableSelect } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { useState } from "react";

type PortData = {
  id: number;
  port_code: string;
  port_name: string;
  transport_mode: string;
  country: string;
  status: "ACTIVE" | "INACTIVE";
};

function NewPortMaster() {
  const navigate = useNavigate();
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string | null>(
    null
  );

  const schema = yup.object().shape({
    port_code: yup.string().required("Port Code is required"),
    port_name: yup.string().required("Port Name is required"),
    transport_mode: yup.string().required("Transport Mode is required"),
    country: yup.string().required("Country is required"),
  });

  const portForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      port_code: "",
      port_name: "",
      transport_mode: "",
      country: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleCreateForm = async (values: PortData): Promise<void> => {
    // console.log("Test=", values);

    try {
      // Add status manually before sending
      // const finalData = { ...values, status: "INACTIVE" };

      const res = await postAPICall(URL.portMaster, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "New Port created successfully",
      });
      navigate("/master/port");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while creating port: ${err.message}`,
      });
    }
  };

  const handleOriginSelect = (originCode: string | null) => {
    setSelectedOrigin(originCode);
    if (originCode) {
      console.log("Selected origin:", originCode);
    }
  };

  const handleDestinationSelect = (destinationCode: string | null) => {
    setSelectedDestination(destinationCode);
    if (destinationCode) {
      console.log("Selected destination:", destinationCode);
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={portForm.onSubmit(handleCreateForm)}
    >
      <Text fw={500} my={"md"}>
        Create Port
      </Text>

      {/* Searchable Origin Selection */}
      <Stack mb="md">
        <SearchableSelect
          apiEndpoint={URL.portMaster}
          label="Search Origin Port"
          placeholder="Search by port code or name"
          value={selectedOrigin}
          onChange={handleOriginSelect}
          searchFields={["port_code", "port_name"]}
          displayFormat={(item) => ({
            value: String(item.port_code),
            label: `${item.port_code} - ${item.port_name}`,
          })}
        />
      </Stack>

      {/* Searchable Destination Selection */}
      <Stack mb="md">
        <SearchableSelect
          apiEndpoint={URL.portMaster}
          label="Search Destination Port"
          placeholder="Search by port code or name"
          value={selectedDestination}
          onChange={handleDestinationSelect}
          searchFields={["port_code", "port_name"]}
          displayFormat={(item) => ({
            value: String(item.port_code),
            label: `${item.port_code} - ${item.port_name}`,
          })}
        />
      </Stack>

      <Group grow mb="md">
        <TextInput
          label="Port Code"
          withAsterisk
          key={portForm.key("port_code")}
          {...portForm.getInputProps("port_code")}
        />
        <TextInput
          label="Port Name"
          withAsterisk
          key={portForm.key("port_name")}
          {...portForm.getInputProps("port_name")}
        />
      </Group>

      <Group grow mb="md">
        <TextInput
          label="Transport Mode"
          withAsterisk
          key={portForm.key("transport_mode")}
          {...portForm.getInputProps("transport_mode")}
        />
        <TextInput
          label="Country"
          withAsterisk
          key={portForm.key("country")}
          {...portForm.getInputProps("country")}
        />
      </Group>

      <Stack justify="space-between" mt={"40%"}>
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            c={"#105476"}
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/port")}
          >
            Back
          </Button>
          <Flex gap={"md"}>
            <Button
              variant="outline"
              c={"#105476"}
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              onClick={() => navigate("/master/port")}
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

export default NewPortMaster;
