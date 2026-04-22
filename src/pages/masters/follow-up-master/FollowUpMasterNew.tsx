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
  NumberInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import * as yup from "yup";
import { yupResolver } from "mantine-form-yup-resolver";
import { ToastNotification } from "../../../components";
import { postAPICall } from "../../../service/postApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { toTitleCase } from "../../../utils/textFormatter";

type FollowUpData = {
  followup_name: string;
  call_code: string; // FK from CallModeMaster
  followup_days: number;
  status: "ACTIVE" | "INACTIVE";
};

function FollowUpMasterNew() {
  const navigate = useNavigate();
  const [callModeOptions, setCallModeOptions] = useState<
    { label: string; value: string }[]
  >([]);

  // Fetch CallModeMaster dropdown (only ACTIVE)
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
      } catch (err: any) {
        ToastNotification({
          type: "error",
          message: `Error fetching call modes: ${err.message}`,
        });
      }
    };

    fetchCallModes();
  }, []);

  const schema = yup.object().shape({
    followup_name: yup.string().required("Follow-Up Name is required"),
    call_code: yup.string().required("Call Mode is required"),
    followup_days: yup
      .number()
      .typeError("Follow-Up Days must be a number")
      .required("Follow-Up Days is required")
      .min(1, "Minimum 1 day required"),
  });

  const form = useForm<FollowUpData>({
    mode: "uncontrolled",
    initialValues: {
      followup_name: "",
      call_code: "",
      followup_days: 1,
      status: "ACTIVE", // default
    },
    validate: yupResolver(schema),
  });

  const followUpSubmit = async (values: FollowUpData) => {
    try {
      await postAPICall(URL.followUpAction, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Follow-Up created successfully",
      });
      navigate("/master/follow-up");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error creating Follow-Up: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "80%", padding: "0 10%" }}
      onSubmit={form.onSubmit(followUpSubmit)}
    >
      <Text fw={500} my="md">
        Create Follow-Up
      </Text>

      <Group grow mb="md">
        <TextInput
          label="Follow-Up Name"
          withAsterisk
          value={form.values.followup_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            form.setFieldValue("followup_name", formattedValue);
          }}
          error={form.errors.followup_name}
        />
        <Select
          label="Type"
          placeholder="Select type"
          data={callModeOptions}
          searchable
          withAsterisk
          {...form.getInputProps("call_code")}
        />
        <NumberInput
          label="Follow-Up Days"
          min={1}
          withAsterisk
          {...form.getInputProps("followup_days")}
        />
      </Group>

      <Stack justify="space-between" mt="40%">
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
              Submit
            </Button>
          </Flex>
        </Flex>
      </Stack>
    </Box>
  );
}

export default FollowUpMasterNew;
