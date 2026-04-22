import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Popover,
  SegmentedControl,
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

type ContainerData = {
  container_code: string;
  container_name: string;
  container_type: string;
  max_load_volume: string;
  max_load_weight: string;
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function ContainerTypeView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);
  const viewData = location.state as ContainerData | undefined;

  if (!viewData) {
    return <Text>No data to display.</Text>;
  }

  const handleDelete = async (value: ContainerData) => {
    try {
      await deleteApiCall(URL.containerType, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: "Container type deleted successfully",
      });
      navigate("/master/container-type");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error deleting container: ${err.message}`,
      });
    }
  };

  return (
    <Box style={{ width: "90%", padding: "0 10%" }}>
      <Group justify="space-between">
        <Text fw={500} my="md">
          View Container Type
        </Text>
        <Group gap={50}>
          <SegmentedControl
            size="xs"
            value={viewData.status}
            data={STATUS_OPTIONS}
            radius="sm"
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

          <Button
            size="xs"
            w={100}
            variant="outline"
            styles={{
              root: { color: "#105476", borderColor: "#105476" },
            }}
            leftSection={<IconEdit size={16} />}
            onClick={() =>
              navigate("/master/container-type-edit", { state: viewData })
            }
          >
            Edit
          </Button>
        </Group>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput label="Container Code" value={viewData.container_code} w={200} />
        </Box>
        <Box>
          <TextInput label="Container Name" value={viewData.container_name} w={200} />
        </Box>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput label="Container Type" value={viewData.container_type} w={200} />
        </Box>
        <Box>
          <TextInput label="Max Load Volume" value={viewData.max_load_volume} w={200} />
        </Box>
        <Box>
          <TextInput label="Max Load Weight" value={viewData.max_load_weight} w={200} />
        </Box>
      </Group>

      <Stack mt={"30%"}>
        <Divider my="md" />
        <Flex gap="sm" justify="space-between" align="center" w="100%">
          <Popover
            opened={opened}
            width={240}
            position="right-start"
            offset={15}
            clickOutsideEvents={["mouseup", "touchend"]}
            radius="md"
          >
            <Popover.Target>
              <Button
                onClick={open}
                w={120}
                variant="outline"
                styles={{
                  root: { color: "#105476", borderColor: "red" },
                }}
                c="red"
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
                Are you sure?<br />Do you want to delete this?
              </Text>
              <Group mt={10} gap="lg">
                <Button variant="outline" color="#105476" size="xs" onClick={close}>
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
            variant="outline"
            styles={{
              root: { color: "#105476", borderColor: "#105476" },
            }}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/container-type")}
          >
            Back
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}

export default ContainerTypeView;
