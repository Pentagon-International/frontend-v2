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

type FrequencyData = {
  id: number;
  frequency_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  frequency_name: yup.string().required("Frequency Name is required"),
});

function FrequencyMasterEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const editFormData = location.state as FrequencyData | undefined;

  const editForm = useForm<FrequencyData>({
    initialValues: {
      id: editFormData?.id || 0,
      frequency_name: editFormData?.frequency_name || "",
      status: editFormData?.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleEditForm = async (values: FrequencyData): Promise<void> => {
    try {
      await putAPICall(URL.frequency, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: "Frequency updated successfully",
      });
      navigate("/master/frequency");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while updating Frequency: ${err.message}`,
      });
    }
  };

  const handleBack = () => {
    navigate("/master/frequency");
  };

  return (
    <Box
      component="form"
      style={{ width: "90%", padding: "0 10%" }}
      onSubmit={editForm.onSubmit(handleEditForm)}
    >
      <Group justify="space-between">
        <Text fw={500} my="md">
          Edit Frequency
        </Text>
        <SegmentedControl
          data={[
            { label: "Active", value: "ACTIVE" },
            { label: "Inactive", value: "INACTIVE" },
          ]}
          {...editForm.getInputProps("status")}
          size="xs"
          radius="sm"
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
            label="Frequency Name"
            withAsterisk
            w={200}
            value={editForm.values.frequency_name}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("frequency_name", formattedValue);
            }}
            error={editForm.errors.frequency_name}
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
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={handleBack}
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
              variant="outline"
              onClick={() => navigate("/master/frequency")}
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

export default FrequencyMasterEdit;
