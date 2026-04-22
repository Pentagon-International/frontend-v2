import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Stack,
  Text,
  TextInput,
  Select,
  SegmentedControl,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { useEffect, useState } from "react";
import { ToastNotification } from "../../../components";
import { putAPICall } from "../../../service/putApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { toTitleCase } from "../../../utils/textFormatter";

type FollowUpData = {
  id: number;
  followup_name: string;
  call_code: string;
  followup_days: number;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  followup_name: yup.string().required("Name is required"),
  call_code: yup.string().required("Call Mode is required"),
  followup_days: yup
    .number()
    .typeError("Follow-up Days must be a number")
    .required("Follow-up Days is required")
    .min(1, "At least 1 day"),
});

function FollowUpMasterEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state as FollowUpData;

  const [callModeOptions, setCallModeOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const followUpForm = useForm<FollowUpData>({
    initialValues: {
      id: editData?.id ?? 0,
      followup_name: editData?.followup_name ?? "",
      call_code: editData?.call_code ?? "",
      followup_days: editData?.followup_days ?? 1,
      status: editData?.status ?? "ACTIVE",
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
    const fetchCallModes = async () => {
      try {
        const res = await getAPICall(URL.callMode, API_HEADER);
        const dropdown = res
          .filter((item: any) => item.status === "ACTIVE")
          .map((item: any) => ({
            value: item.call_code,
            label: item.callmode_name,
          }));
        setCallModeOptions(dropdown);
      } catch (error: any) {
        ToastNotification({
          type: "error",
          message: `Error loading Call Modes: ${error.message}`,
        });
      }
    };

    fetchCallModes();
  }, []);

  const handleEditForm = async (values: FollowUpData) => {
    try {
      await putAPICall(URL.followUp, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Follow-Up updated successfully",
      });
      navigate("/master/follow-up");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while updating Follow-Up: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={followUpForm.onSubmit(handleEditForm)}
    >
      <Group justify="space-between">
        <Text fw={500} my="md">
          Edit Follow-Up
        </Text>
        <SegmentedControl
          {...followUpForm.getInputProps("status")}
          data={[
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
          size="xs"
          radius="sm"
          styles={{
            root: {
              backgroundColor: "#E4E4E4",
              color: "#105476",
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

      <Group grow mb="md">
        <TextInput
          label="Follow-Up Name"
          withAsterisk
          type="text"
          value={followUpForm.values.followup_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            followUpForm.setFieldValue("followup_name", formattedValue);
          }}
          error={followUpForm.errors.followup_name}
        />
        <Select
          label="type"
          placeholder="type"
          withAsterisk
          data={callModeOptions}
          searchable
          {...followUpForm.getInputProps("call_code")}
        />
        <TextInput
          label="Follow-Up Days"
          withAsterisk
          type="number"
          {...followUpForm.getInputProps("followup_days")}
        />
      </Group>

      <Stack justify="space-between" mt={"40%"}>
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/follow-up")}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
          >
            Back
          </Button>

          <Flex gap="md">
            <Button
              variant="outline"
              onClick={() => navigate("/master/follow-up")}
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
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
          </Flex>
        </Flex>
      </Stack>
    </Box>
  );
}

export default FollowUpMasterEdit;
