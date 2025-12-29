import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { putAPICall } from "../../../service/putApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { toTitleCase } from "../../../utils/textFormatter";

type CustomerTypeData = {
  id: number;
  customer_type_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  customer_type_name: yup.string().required("Customer Type Name is required"),
});

function CustomerTypeEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state as CustomerTypeData;

  const form = useForm<CustomerTypeData>({
    initialValues: {
      id: editData?.id,
      customer_type_name: editData?.customer_type_name || "",
      status: editData?.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

  const customerTypeSubmit = async (values: CustomerTypeData) => {
    try {
      await putAPICall(URL.customerType, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Customer Type updated successfully",
      });
      navigate("/master/customer-type");
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while updating: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "90%", padding: "0 10%" }}
      onSubmit={form.onSubmit(customerTypeSubmit)}
    >
      <Group justify="space-between">
        <Text fw={500} my="md">
          Edit Customer Type
        </Text>
        <SegmentedControl
          size="xs"
          radius="sm"
          data={[
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
          {...form.getInputProps("status")}
          styles={{
            root: { backgroundColor: "#E4E4E4", width: 150 },
            indicator: { backgroundColor: "#105476" },
            label: {
              color: "#105476",
              "&[data-active]": { color: "#ffffff" },
            },
          }}
        />
      </Group>

      <TextInput
        label="Customer Type Name"
        withAsterisk
        value={form.values.customer_type_name}
        onChange={(e) => {
          const formattedValue = toTitleCase(e.target.value);
          form.setFieldValue("customer_type_name", formattedValue);
        }}
        error={form.errors.customer_type_name}
        w={250}
        mb="lg"
      />

      <Stack justify="space-between" mt={"30%"}>
        <Divider my="md" />
        <Flex justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/customer-type")}
          >
            Back
          </Button>
          <Group>
            <Button
              variant="outline"
              color="#105476"
              onClick={() => navigate("/master/customer-type")}
            >
              Cancel
            </Button>
            <Button
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

export default CustomerTypeEdit;
