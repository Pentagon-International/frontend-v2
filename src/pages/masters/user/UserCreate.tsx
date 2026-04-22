import {
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  Group,
  PasswordInput,
  Select,
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

type GroupData = {
  id: number;
  group_code: string;
  group_name: string;
  status: "ACTIVE" | "INACTIVE";
};

function UserCreate() {
  const navigate = useNavigate();
  const schema = yup.object().shape({
    group_code: yup.string().required("Group Code is required"),
    group_name: yup.string().required("Group Name is required"),
  });

  const userForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      emp_name: "",
      employee_id: "",
      company_name: "",
      user_name: "",
      password: "",
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
      px={"xl"}
      //   style={{ width: "80%", padding: "0 10%" }}
      onSubmit={userForm.onSubmit(handleCreateForm)}
    >
      <Text fw={500} my={10}>
        Create User
      </Text>
      <Grid

      //   p="sm"
      >
        <Grid.Col span={3}>
          <TextInput
            label="Employee Name"
            placeholder="Enter Employee Name"
            value={userForm.values.emp_name}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              userForm.setFieldValue("emp_name", formattedValue);
            }}
            error={userForm.errors.emp_name}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <TextInput
            label="Employee Code"
            placeholder="Enter Employee Code"
            {...userForm.getInputProps("employee_id")}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <Select
            label="Company"
            placeholder="Select Mobile Number"
            {...userForm.getInputProps("company_name")}
          />
        </Grid.Col>
      </Grid>
      <Grid>
        <Grid.Col span={3}>
          <TextInput
            label="User Name"
            placeholder="Enter User Name"
            {...userForm.getInputProps("user_name")}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <PasswordInput
            label="Password"
            placeholder="Enter Password"
            {...userForm.getInputProps("password")}
          />
        </Grid.Col>
      </Grid>

      <Stack justify="space-between" mt={"20%"}>
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

export default UserCreate;
