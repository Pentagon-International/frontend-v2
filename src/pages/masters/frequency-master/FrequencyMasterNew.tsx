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

type FrequencyData = {
  id?: number;
  frequency_name: string;
  status: "ACTIVE" | "INACTIVE";
};

function FrequencyMasterNew() {
  const navigate = useNavigate();

  const schema = yup.object().shape({
    frequency_name: yup.string().required("Frequency Name is required"),
  });

  const frequencyForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      frequency_name: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleCreateForm = async (values: FrequencyData): Promise<void> => {
    try {
      const res = await postAPICall(URL.frequency, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "New Frequency created successfully",
      });
      navigate("/master/frequency");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while creating Frequency: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={frequencyForm.onSubmit(handleCreateForm)}
    >
      <Text fw={500} my={"md"}>
        Create Frequency
      </Text>

      <Group grow mb="md">
        <TextInput
          label="Frequency Name"
          withAsterisk
          key={frequencyForm.key("frequency_name")}
          value={frequencyForm.values.frequency_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            frequencyForm.setFieldValue("frequency_name", formattedValue);
          }}
          error={frequencyForm.errors.frequency_name}
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
            onClick={() => navigate("/master/frequency")}
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
              onClick={() => navigate("/master/frequency")}
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

export default FrequencyMasterNew;
