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

type PortData = {
  id: number;
  port_code: string;
  port_name: string;
  transport_mode: string;
  country_name: string; 
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function PortMasterView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);

  const viewData = location.state as PortData | undefined;

  if (!viewData) {
    return <p>No data to display.</p>;
  }

  const handleDelete = async (value: PortData) => {
    try {
      await deleteApiCall(URL.portMaster, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: `Port successfully deleted`,
      });
      navigate("/master/port");
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting Port: ${err.message}`,
      });
    }
  };

  return (
    <Box component="form" style={{ width: "90%", padding: "0 10%" }}>
      <Group justify="space-between">
        <Text fw={500} my="md">
          View Port
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

          <Button
            size="xs"
            w={100}
            variant="outline"
            leftSection={<IconEdit size={16} />}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            onClick={() =>
              navigate("/master/port-edit", { state: viewData })
            }
          >
            Edit
          </Button>
        </Group>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Port Code"
            withAsterisk
            w={200}
            value={viewData.port_code}
            readOnly
          />
        </Box>
        <Box>
          <TextInput
            label="Port Name"
            withAsterisk
            w={200}
            value={viewData.port_name}
            readOnly
          />
        </Box>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Transport Mode"
            withAsterisk
            w={200}
            value={viewData.transport_mode}
            readOnly
          />
        </Box>
        <Box>
          <TextInput
            label="Country"
            withAsterisk
            w={200}
            value={viewData.country} 
            readOnly
          />
        </Box>
      </Group>

      <Stack justify="space-between" mt={"30%"}>
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
                w={120}
                variant="outline"
                c={"red"}
                onClick={open}
                leftSection={<IconTrash size={16} />}
                styles={{
                  root: {
                    color: "#105476",
                    borderColor: "red",
                  },
                }}
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
            variant="outline"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/port")}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
          >
            Back
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}

export default PortMasterView;
