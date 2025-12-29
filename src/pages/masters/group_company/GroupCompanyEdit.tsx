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

type GroupData = {
  id: number;
  group_code: string;
  group_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  group_code: yup.string().required("Group Code is required"),
  group_name: yup.string().required("Group Name is required"),
});

function GroupCompanyEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  const editFormData = location.state as GroupData | undefined;

  const editForm = useForm<GroupData>({
    initialValues: {
      id: editFormData?.id || undefined,
      group_code: editFormData?.group_code || "",
      group_name: editFormData?.group_name || "",
      status: editFormData?.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleEditForm = async (values: GroupData): Promise<void> => {
    // editForm.reset();

    try {
      const res = await putAPICall(URL.groupCompany, values, API_HEADER);
      navigate("/master/group-company");
      ToastNotification({
        type: "success",
        message: `Group is updated`,
      });
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err.message}`,
      });
    }
  };

  function handleBack() {
    // console.log("handleBack check");

    if (editFormData?.from === "view") {
      navigate("/master/group-company-view", {
        state: editFormData,
      });
    } else {
      navigate("/master/group-company");
    }
  }

  return (
    <>
      <Box
        component="form"
        style={{ width: "90%", padding: "0 10%" }}
        onSubmit={editForm.onSubmit(handleEditForm)}
      >
        <Group justify="space-between">
          <Text fw={500} my={"md"}>
            Edit Group
          </Text>
          <SegmentedControl
            // value={formType}
            // onChange={handleSegmentChange}
            // fullWidth
            size="xs"
            radius="sm"
            data={[
              { label: "Active", value: "ACTIVE" },
              { label: "Inactive", value: "INACTIVE" },
            ]}
            {...editForm.getInputProps("status")}
            styles={{
              root: {
                backgroundColor: "#E4E4E4",
                color: "105476",
                width: "150px",
              },
              indicator: {
                backgroundColor: "#105476",
              },
              label: {
                color: "#105476",
                "&[data-active]": {
                  color: "#ffffff",
                },
              },
            }}
          />
        </Group>
        <Group mb="md" gap={100}>
          <Box>
            <TextInput
              label="Group Code"
              withAsterisk
              {...editForm.getInputProps("group_code")}
              w={200}
            />
          </Box>
          <Box>
            <TextInput
              label="Group Name"
              w={200}
              withAsterisk
              value={editForm.values.group_name}
              onChange={(e) => {
                const formattedValue = toTitleCase(e.target.value);
                editForm.setFieldValue("group_name", formattedValue);
              }}
              error={editForm.errors.group_name}
            />
          </Box>
        </Group>

        <Stack justify="space-between" mt={"30%"}>
          <Divider my="md" />
          <Flex gap="sm" justify="space-between" align="center" w="100%">
            <Button
              w={130}
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              c={"#105476"}
              variant="outline"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => handleBack()}
            >
              Back
            </Button>
            <Group>
              <Button
                w={130}
                styles={{
                  root: {
                    color: "#105476",
                    borderColor: "#105476",
                  },
                }}
                c={"#105476"}
                variant="outline"
                onClick={() => navigate("/master/group-company")}
              >
                Cancel
              </Button>
              <Button
                w={130}
                type="submit"
                color={"#105476"}
                variant="filled"
                rightSection={<IconCheck size={16} />}
              >
                Update
              </Button>
            </Group>
          </Flex>
        </Stack>
      </Box>
    </>
  );
}

export default GroupCompanyEdit;
