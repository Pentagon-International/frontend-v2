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
import axios from "axios";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type GroupData = {
  id: number;
  group_code: string;
  group_name: string;
  status: "ACTIVE" | "INACTIVE";
};

function NewGroupCompany() {
  const navigate = useNavigate();
  const schema = yup.object().shape({
    group_code: yup.string().required("Group Code is required"),
    group_name: yup.string().required("Group Name is required"),
  });

  const groupForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      group_code: "",
      group_name: "",
      status: "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleCreateForm = async (values: GroupData): Promise<void> => {
    try {
      const res = await postAPICall(URL.groupCompany, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "New Group Data is created",
      });
      navigate("/master/group-company");
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err.message}`,
      });
    }

    // groupForm.reset();
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={groupForm.onSubmit(handleCreateForm)}
    >
      <Text fw={500} my={"md"}>
        Create Code
      </Text>
      <Group grow mb="md">
        <TextInput
          label="Group Code"
          withAsterisk
          key={groupForm.key("group_code")}
          {...groupForm.getInputProps("group_code")}
        />
        <TextInput
          withAsterisk
          label="Group Name"
          key={groupForm.key("group_name")}
          {...groupForm.getInputProps("group_name")}
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
            onClick={() => navigate("/master/group-company")}
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
              onClick={() => navigate("/master/group-company")}
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

export default NewGroupCompany;
