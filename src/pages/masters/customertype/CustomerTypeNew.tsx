// pages/masters/customertype/CustomerTypeNew.tsx

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

type CustomerTypeData = {
  customer_type_name: string;
  status: "ACTIVE" | "INACTIVE";
};

function CustomerTypeNew() {
  const navigate = useNavigate();

  const schema = yup.object().shape({
    customer_type_name: yup.string().required("Customer Type Name is required"),
  });

  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      customer_type_name: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleCreateForm = async (values: CustomerTypeData): Promise<void> => {
    console.log("checkkkkk-----",values);
    
    try {
      await postAPICall(URL.customerType, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Customer Type created successfully",
      });
      navigate("/master/customer-type");
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error creating Customer Type: ${err.message}`,
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
        Create Customer Type
      </Text>

      <Group grow mb="md">
        <TextInput
          label="Customer Type Name"
          withAsterisk
          key={form.key("customer_type_name")}
          value={form.values.customer_type_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            form.setFieldValue("customer_type_name", formattedValue);
          }}
          error={form.errors.customer_type_name}
        />
      </Group>

      <Stack justify="space-between" mt="40%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            c="#105476"
            styles={{ root: { borderColor: "#105476" } }}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/customer-type")}
          >
            Back
          </Button>

          <Flex gap="md">
            <Button
              variant="outline"
              c="#105476"
              styles={{ root: { borderColor: "#105476" } }}
              onClick={() => navigate("/master/customer-type")}
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

export default CustomerTypeNew;
