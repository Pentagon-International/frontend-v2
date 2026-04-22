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

type CallModeData = {
  call_mode_code: string;
  callmode_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS: { label: string; value: "ACTIVE" | "INACTIVE" }[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function CallModeView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);

  const viewData = location.state as CallModeData | undefined;

  if (!viewData) {
    return <p>No data to display.</p>;
  }

  const handleDelete = async (value: CallModeData) => {
    try {
      await deleteApiCall(URL.callMode, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: "Call Mode is successfully deleted",
      });
      navigate("/master/call-mode");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while deleting Call Mode: ${err.message}`,
      });
    }
  };

  return (
    <Box component="form" style={{ width: "90%", padding: "0 10%" }}>
      <Group justify="space-between">
        <Text fw={500} my="md">
          View Call Mode
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
            c="#105476"
            styles={{ root: { borderColor: "#105476" } }}
            leftSection={<IconEdit size={16} />}
            onClick={() =>
              navigate("/master/callmode-master-edit", { state: viewData })
            }
          >
            Edit
          </Button>
        </Group>
      </Group>

      <Group mb="md">
        <Box>
          <TextInput
            label="Call Mode Name"
            withAsterisk
            value={viewData.callmode_name}
            w={200}
            readOnly
          />
        </Box>
      </Group>

      <Stack justify="space-between" mt="30%">
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
                c="red"
                variant="outline"
                leftSection={<IconTrash size={16} />}
                styles={{ root: { borderColor: "red" } }}
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
            c="#105476"
            styles={{ root: { borderColor: "#105476" } }}
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/call-mode")}
          >
            Back
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}

export default CallModeView;
