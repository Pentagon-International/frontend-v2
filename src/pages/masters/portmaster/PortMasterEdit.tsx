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

type PortData = {
  id: number;
  port_code: string;
  port_name: string;
  transport_mode: string;
  country: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  port_code: yup.string().required("Port Code is required"),
  port_name: yup.string().required("Port Name is required"),
  transport_mode: yup.string().required("Transport Mode is required"),
  country: yup.string().required("Country is required"),
});

function PortMasterEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  const editFormData = location.state as PortData | undefined;

  const editForm = useForm<PortData>({
    initialValues: {
      id: editFormData?.id || undefined,
      port_code: editFormData?.port_code || "",
      port_name: editFormData?.port_name || "",
      transport_mode: editFormData?.transport_mode || "",
      country: editFormData?.country || "",
      status: editFormData?.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleEditForm = async (values: PortData): Promise<void> => {
    try {
      const res = await putAPICall(URL.portMaster, values, API_HEADER);
      navigate("/master/port");
      ToastNotification({
        type: "success",
        message: `Port is updated`,
      });
    } catch (err) {
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
        <Text fw={500} my={"md"}>
          Edit Port
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

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Port Code"
            withAsterisk
            w={200}
            {...editForm.getInputProps("port_code")}
          />
        </Box>
        <Box>
          <TextInput
            label="Port Name"
            withAsterisk
            w={200}
            value={editForm.values.port_name}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("port_name", formattedValue);
            }}
            error={editForm.errors.port_name}
          />
        </Box>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Transport Mode"
            withAsterisk
            w={200}
            value={editForm.values.transport_mode}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("transport_mode", formattedValue);
            }}
            error={editForm.errors.transport_mode}
          />
        </Box>
        <Box>
          <TextInput
            label="Country"
            withAsterisk
            w={200}
            value={editForm.values.country}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("country", formattedValue);
            }}
            error={editForm.errors.country}
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
            onClick={() =>
              navigate("/master/port-view", { state: editFormData })
            }
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
              onClick={() => navigate("/master/port")}
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
  );
}

export default PortMasterEdit;
