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

type CallModeData = {
  id: string;
  call_code: number;
  callmode_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  callmode_name: yup.string().required("Call Mode Name is required"),
});

function CallModeEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  const editFormData = location.state as CallModeData | undefined;
  console.log("editFormData=",editFormData);
  

  const editForm = useForm<CallModeData>({
    initialValues: {
      id: editFormData?.id,
      call_code: editFormData?.call_code || 0,
      callmode_name: editFormData?.callmode_name || "",
      status: editFormData?.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleEditForm = async (values: CallModeData): Promise<void> => {
    console.log("value check=",values);
    
    try {
      const response = await putAPICall(URL.callMode, values, API_HEADER);

      ToastNotification({
        type: "success",
        message: `Call Mode updated successfully`,
      });

      // ✅ Wait until toast, then navigate back
      setTimeout(() => {
        navigate("/master/call-mode");
      }, 500); // slight delay so user sees toast
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while updating data: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "90%", padding: "0 10%" }}
      onSubmit={editForm.onSubmit(handleEditForm)}
    >
      <Group justify="space-between">
        <Text fw={500} my="md">
          Edit Call Mode
        </Text>
        <SegmentedControl
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

      <Group mb="md">
        <Box>
          <TextInput
            label="Call Mode Name"
            withAsterisk
            value={editForm.values.callmode_name}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("callmode_name", formattedValue);
            }}
            error={editForm.errors.callmode_name}
            w={200}
          />
        </Box>
      </Group>

      <Stack justify="space-between" mt="30%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            w={130}
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            onClick={() =>
              navigate("/master/callmode-master-view", { state: editFormData })
            }
          >
            Back
          </Button>
          <Group>
            <Button
              w={130}
              variant="outline"
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              onClick={() => navigate("/master/call-mode")}
            >
              Cancel
            </Button>
            <Button
              w={130}
              type="submit"
              color="#105476"
              variant="filled"
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

export default CallModeEdit;
