import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Popover,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowLeft, IconEdit, IconTrash } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type TermsOfShipmentData = {
  tos_code: string;
  tos_name: string;
  freight: string;
  service_id: string;
  description: string;
};

function TermsOfShipmentView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);
  const viewData = location.state as TermsOfShipmentData | undefined;

  if (!viewData) {
    return (
      <Box p="md">
        <Text c="red" fw={600}>
          No data to display.
        </Text>
        <Button mt="sm" onClick={() => navigate("/master/terms-of-shipment")}>
          Back to List
        </Button>
      </Box>
    );
  }

  const handleDelete = async (value: TermsOfShipmentData) => {
    try {
      await deleteApiCall(URL.termsOfShipment, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: `Terms of Shipment successfully deleted`,
      });
      navigate("/master/terms-of-shipment");
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting: ${err.message}`,
      });
    }
  };

  return (
    <Box style={{ width: "90%", padding: "0 10%" }}>
      <Group justify="space-between">
        <Text fw={500} my="md">
          View Terms of Shipment
        </Text>
        <Button
          size="xs"
          w={100}
          styles={{ root: { color: "#105476", borderColor: "#105476" } }}
          c="#105476"
          variant="outline"
          leftSection={<IconEdit size={16} />}
          onClick={() =>
            navigate("/master/terms-of-shipment-edit", { state: viewData })
          }
        >
          Edit
        </Button>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Code"
            value={viewData.tos_code}
            w={200}
            readOnly
            variant="filled"
          />
        </Box>
        <Box>
          <TextInput
            label="Name"
            value={viewData.tos_name}
            w={200}
            readOnly
            variant="filled"
          />
        </Box>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Freight"
            value={viewData.freight}
            w={200}
            readOnly
            variant="filled"
          />
        </Box>
        <Box>
          <TextInput
            label="Service"
            value={viewData.service}
            w={200}
            readOnly
            variant="filled"
          />
        </Box>
      </Group>

      <TextInput
        label="Description"
        value={viewData.description}
        w={420}
        readOnly
        variant="filled"
      />

      <Stack justify="space-between" mt="30%">
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Popover
            opened={opened}
            width={240}
            position="right-start"
            offset={15}
            radius="md"
          >
            <Popover.Target>
              <Button
                onClick={open}
                w={120}
                styles={{ root: { color: "#105476", borderColor: "red" } }}
                c="red"
                variant="outline"
                leftSection={<IconTrash size={16} />}
              >
                Delete
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Group mb={5} gap="xs">
                <IconTrash color="red" size={16} />
                <Text size="sm" c="red" fw={700}>
                  Delete
                </Text>
              </Group>
              <Text size="sm" mb="xs">
                Are you sure?
                <br />
                Do you want to delete this?
              </Text>
              <Group mt={10} gap="lg">
                <Button
                  variant="outline"
                  color="#105476"
                  size="xs"
                  onClick={close}
                >
                  Not now
                </Button>
                <Button
                  size="xs"
                  color="#FF0004"
                  style={{ width: "100px" }}
                  onClick={() => {
                    handleDelete(viewData);
                    close();
                  }}
                >
                  Yes, Delete
                </Button>
              </Group>
            </Popover.Dropdown>
          </Popover>

          <Button
            w={120}
            styles={{ root: { color: "#105476", borderColor: "#105476" } }}
            c="#105476"
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/terms-of-shipment")}
          >
            Back
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}

export default TermsOfShipmentView;
