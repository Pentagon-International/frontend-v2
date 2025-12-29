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
  NumberInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowLeft, IconEdit, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type FollowUpData = {
  id: number;
  followup_name: string;
  call_code: string;
  followup_days: number;
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function FollowUpMasterView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);
  const viewData = location.state as FollowUpData | undefined;

  const [callModeName, setCallModeName] = useState<string>("");

  useEffect(() => {
    const fetchCallModes = async () => {
      try {
        const res = await getAPICall(URL.callMode, API_HEADER);
        const activeModes = res.filter((item: any) => item.status === "ACTIVE");
        const matched = activeModes.find((item: any) => item.call_code === viewData?.call_code);
        if (matched) {
          setCallModeName(matched.callmode_name);
        }
      } catch (err: any) {
        ToastNotification({
          type: "error",
          message: `Error loading call modes: ${err.message}`,
        });
      }
    };

    if (viewData?.call_code) {
      fetchCallModes();
    }
  }, [viewData]);

  if (!viewData || !viewData.id) {
    return <Text>No data to display.</Text>;
  }

  const handleDelete = async (value: FollowUpData) => {
    try {
      await deleteApiCall(URL.followUp, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: "Follow-up entry deleted successfully",
      });
      navigate("/master/follow-up");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while deleting: ${err.message}`,
      });
    }
  };

  return (
    <Box component="form" style={{ width: "90%", padding: "0 10%" }}>
      <Group justify="space-between">
        <Text fw={500} my="md">
          View Follow-up
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
            leftSection={<IconEdit size={16} />}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            onClick={() =>
              navigate("/master/follow-up-edit", {
                state: { ...viewData, from: "view" },
              })
            }
          >
            Edit
          </Button>
        </Group>
      </Group>

      <Group mb="md" gap={100}>
        <Box>
          <TextInput
            label="Follow-up Name"
            withAsterisk
            w={200}
            value={viewData.followup_name}
            readOnly
          />
        </Box>
        <Box>
          <TextInput
            label="type"
            withAsterisk
            w={200}
            value={callModeName}
            readOnly
          />
        </Box>
      </Group>

      <Group mb="md">
        <Box>
          <NumberInput
            label="Follow-up Days"
            withAsterisk
            w={200}
            value={viewData.followup_days}
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
            radius={"md"}
          >
            <Popover.Target>
              <Button
                onClick={open}
                w={120}
                variant="outline"
                leftSection={<IconTrash size={16} />}
                styles={{
                  root: {
                    color: "#105476",
                    borderColor: "red",
                  },
                }}
                c={"red"}
              >
                Delete
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Group mb={5} gap={"xs"}>
                <IconTrash color="red" size={16} />
                <Text size="sm" c="red" fw={700}>
                  Delete
                </Text>
              </Group>
              <Text size="sm" mb="xs">
                Are you sure? <br />
                Do you want to delete this?
              </Text>
              <Group mt={10} gap={"lg"}>
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
            onClick={() => navigate("/master/follow-up")}
            styles={{
              root: {
                color: "#105476",
                borderColor: "#105476",
              },
            }}
            c={"#105476"}
          >
            Back
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}

export default FollowUpMasterView;
