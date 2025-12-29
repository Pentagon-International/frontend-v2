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

type ContainerTypeFormData = {
  id: number;
  container_code: string;
  container_name: string;
  container_type: string;
  max_load_volume: string;
  max_load_weight: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  container_code: yup.string().required("Container Code is required"),
  container_name: yup.string().required("Container Name is required"),
  container_type: yup.string().required("Container Type is required"),
  max_load_volume: yup.string().required("Max Load Volume is required"),
  max_load_weight: yup.string().required("Max Load Weight is required"),
});

function ContainerTypeEdit() {
  const navigate = useNavigate();
  const location = useLocation();

  const editFormData = location.state as ContainerTypeFormData;

  const editForm = useForm<ContainerTypeFormData>({
    initialValues: {
      id: editFormData?.id || 0,
      container_code: editFormData?.container_code || "",
      container_name: editFormData?.container_name || "",
      container_type: editFormData?.container_type || "",
      max_load_volume: editFormData?.max_load_volume || "",
      max_load_weight: editFormData?.max_load_weight || "",
      status: editFormData?.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleEditForm = async (values: ContainerTypeFormData): Promise<void> => {
    try {
      await putAPICall(URL.containerType, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: `Container Type updated successfully`,
      });
      navigate("/master/container-type");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while updating container type: ${err.message}`,
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
          Edit Container Type
        </Text>
        <SegmentedControl
          {...editForm.getInputProps("status")}
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

      <Group mb="md" grow>
        <TextInput
          label="Container Code"
          withAsterisk
          {...editForm.getInputProps("container_code")}
        />
        <TextInput
          label="Container Name"
          withAsterisk
          value={editForm.values.container_name}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            editForm.setFieldValue("container_name", formattedValue);
          }}
          error={editForm.errors.container_name}
        />
      </Group>

      <Group mb="md" grow>
        <TextInput
          label="Container Type"
          withAsterisk
          value={editForm.values.container_type}
          onChange={(e) => {
            const formattedValue = toTitleCase(e.target.value);
            editForm.setFieldValue("container_type", formattedValue);
          }}
          error={editForm.errors.container_type}
        />
        <TextInput
          label="Max Load Volume"
          withAsterisk
          {...editForm.getInputProps("max_load_volume")}
        />
        <TextInput
          label="Max Load Weight"
          withAsterisk
          {...editForm.getInputProps("max_load_weight")}
        />
      </Group>

      <Stack justify="space-between" mt={"30%"}>
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Button
            w={130}
            variant="outline"
            c="#105476"
            styles={{ root: { borderColor: "#105476" } }}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() =>
              navigate("/master/container-type-view", { state: editFormData })
            }
          >
            Back
          </Button>
          <Group>
            <Button
              w={130}
              variant="outline"
              c="#105476"
              onClick={() => navigate("/master/container-type")}
            >
              Cancel
            </Button>
            <Button
              w={130}
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

export default ContainerTypeEdit;
