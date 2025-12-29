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
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { toTitleCase } from "../../../utils/textFormatter";

type ContainerTypeFormData = {
  container_code: string;
  container_name: string;
  container_type: string;
  max_load_volume: string;
  max_load_weight: string;
  status: "ACTIVE" | "INACTIVE";
};

function ContainerTypeNew() {
  const navigate = useNavigate();

  const schema = yup.object().shape({
    container_code: yup.string().required("Container Code is required"),
    container_name: yup.string().required("Container Name is required"),
    container_type: yup.string().required("Container Type is required"),
    max_load_volume: yup.string().required("Max Load Volume is required"),
    max_load_weight: yup.string().required("Max Load Weight is required"),
  });

  const containerForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      container_code: "",
      container_name: "",
      container_type: "",
      max_load_volume: "",
      max_load_weight: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleCreateForm = async (values: ContainerTypeFormData): Promise<void> => {
    console.log("handleCreateForm");
    
    try {
      await postAPICall(URL.containerType, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Container Type created successfully",
      });
      navigate("/master/container-type");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while creating container type: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={containerForm.onSubmit(handleCreateForm)}
    >
      <Text fw={500} my="md">
        Create Container Type
      </Text>

      <Group grow mb="md">
        <TextInput
          label="Container Code"
          withAsterisk
          key={containerForm.key("container_code")}
          {...containerForm.getInputProps("container_code")}
        />
        <TextInput
          label="Container Name"
          withAsterisk
          key={containerForm.key("container_name")}
          value={containerForm.values.container_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            containerForm.setFieldValue("container_name", formattedValue);
          }}
          error={containerForm.errors.container_name}
        />
        <TextInput
          label="Container Type"
          withAsterisk
          key={containerForm.key("container_type")}
          value={containerForm.values.container_type}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            containerForm.setFieldValue("container_type", formattedValue);
          }}
          error={containerForm.errors.container_type}
        />
      </Group>

      <Group grow mb="md">
        <TextInput
          label="Max Load Volume"
          withAsterisk
          key={containerForm.key("max_load_volume")}
          {...containerForm.getInputProps("max_load_volume")}
        />
        <TextInput
          label="Max Load Weight"
          withAsterisk
          key={containerForm.key("max_load_weight")}
          {...containerForm.getInputProps("max_load_weight")}
        />
      </Group>

      <Stack justify="space-between" mt="40%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            c="#105476"
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/container-type")}
          >
            Back
          </Button>
          <Flex gap="md">
            <Button
              variant="outline"
              c="#105476"
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              onClick={() => navigate("/master/container-type")}
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

export default ContainerTypeNew;
