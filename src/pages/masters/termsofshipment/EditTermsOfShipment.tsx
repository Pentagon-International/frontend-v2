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

type TOSData = {
  id: number;
  tos_code: string;
  tos_name: string;
  freight: string;
  service: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
};

const schema = yup.object().shape({
  tos_code: yup.string().required("Code is required"),
  tos_name: yup.string().required("Name is required"),
  freight: yup.string().required("Freight is required"),
  service: yup.string().required("Service is required"),
  description: yup.string().required("Description is required"),
});

function TermsOfShipmentEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const editFormData = location.state as TOSData | undefined;

  if (!editFormData) {
    return (
      <Box p="md">
        <Text c="red">No data to edit. Please go back.</Text>
        <Button mt="sm" onClick={() => navigate("/master/terms-of-shipment")}>
          Back to List
        </Button>
      </Box>
    );
  }

  const editForm = useForm<TOSData>({
    initialValues: {
      id: editFormData.id || 0,
      tos_code: editFormData.tos_code || "",
      tos_name: editFormData.tos_name || "",
      freight: editFormData.freight || "",
      service: editFormData.service || "",
      description: editFormData.description || "",
      status: editFormData.status || "INACTIVE",
    },
    validate: yupResolver(schema),
  });

  const handleEditForm = async (values: TOSData): Promise<void> => {
    try {
      await putAPICall(URL.termsOfShipment, values, API_HEADER);
      ToastNotification({
        type: "success",
        message: `Terms of Shipment updated successfully`,
      });
      navigate("/master/terms-of-shipment");
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
      onSubmit={editForm.onSubmit(handleEditForm)}
    >
      <Group justify="space-between">
        <Text fw={500} my="md">
          Edit Terms of Shipment
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
            label="Code"
            withAsterisk
            {...editForm.getInputProps("tos_code")}
            w={200}
          />
        </Box>
        <Box>
          <TextInput
            label="Name"
            withAsterisk
            value={editForm.values.tos_name}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("tos_name", formattedValue);
            }}
            error={editForm.errors.tos_name}
            w={200}
          />
        </Box>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Freight"
            withAsterisk
            value={editForm.values.freight}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("freight", formattedValue);
            }}
            error={editForm.errors.freight}
            w={200}
          />
        </Box>
        <Box>
          <TextInput
            label="Service"
            withAsterisk
            value={editForm.values.service}
            onChange={(e) => {
              const formattedValue = toTitleCase(e.target.value);
              editForm.setFieldValue("service", formattedValue);
            }}
            error={editForm.errors.service}
            w={200}
          />
        </Box>
      </Group>

      <TextInput
        label="Description"
        withAsterisk
        value={editForm.values.description}
        onChange={(e) => {
          const formattedValue = toTitleCase(e.target.value);
          editForm.setFieldValue("description", formattedValue);
        }}
        error={editForm.errors.description}
        w={420}
      />

      <Stack justify="space-between" mt="30%">
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
            c="#105476"
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() =>
              navigate("/master/terms-of-shipment-view", {
                state: editFormData,
              })
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
              c="#105476"
              variant="outline"
              onClick={() => navigate("/master/terms-of-shipment")}
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

export default TermsOfShipmentEdit;
