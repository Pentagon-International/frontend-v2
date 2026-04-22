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

type TermsOfShipmentData = {
  tos_code: string;
  tos_name: string;
  freight: string;
  service: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  tos_code: yup.string().required("Code is required"),
  tos_name: yup.string().required("Name is required"),
  freight: yup.string().required("Freight is required"),
  service: yup.string().required("Service is required"),
  description: yup.string().required("Description is required"),
});

function NewTermsOfShipment() {
  const navigate = useNavigate();

  const tosForm = useForm<TermsOfShipmentData>({
    initialValues: {
      tos_code: "",
      tos_name: "",
      freight: "",
      service: "",
      description: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleCreateForm = async (
    values: TermsOfShipmentData
  ): Promise<void> => {
    try {
      const res = await postAPICall(URL.termsOfShipment, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Terms of Shipment Created Successfully",
      });
      navigate("/master/terms-of-shipment");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while creating: ${err.message || "Unknown error"}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={tosForm.onSubmit(handleCreateForm)}
    >
      <Text fw={500} my="md">
        Create Terms of Shipment
      </Text>

      <Group grow mb="md">
        <TextInput
          label="Code"
          withAsterisk
          {...tosForm.getInputProps("tos_code")}
        />
        <TextInput
          label="Name"
          withAsterisk
          value={tosForm.values.tos_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            tosForm.setFieldValue("tos_name", formattedValue);
          }}
          error={tosForm.errors.tos_name}
        />
      </Group>

      <Group grow mb="md">
        <TextInput
          label="Freight"
          withAsterisk
          value={tosForm.values.freight}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            tosForm.setFieldValue("freight", formattedValue);
          }}
          error={tosForm.errors.freight}
        />
        <TextInput
          label="Service"
          withAsterisk
          value={tosForm.values.service}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            tosForm.setFieldValue("service", formattedValue);
          }}
          error={tosForm.errors.service}
        />
      </Group>

      <TextInput
        label="Description"
        withAsterisk
        value={tosForm.values.description}
        onChange={(e) => {
          const formattedValue = toTitleCase(e.target.value);
          tosForm.setFieldValue("description", formattedValue);
        }}
        error={tosForm.errors.description}
      />

      <Stack justify="space-between" mt="40%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            c="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/terms-of-shipment")}
          >
            Back
          </Button>
          <Flex gap="md">
            <Button
              variant="outline"
              c="#105476"
              onClick={() => navigate("/master/terms-of-shipment")}
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

export default NewTermsOfShipment;
