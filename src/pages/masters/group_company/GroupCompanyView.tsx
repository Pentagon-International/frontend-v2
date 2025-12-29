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

type GroupData = {
  group_code: string;
  group_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS: { label: string; value: Status }[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function GroupCompanyView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);
  const viewData = location.state as GroupData | undefined;
  // console.log("data check=", viewData);
  if (!viewData) {
    return <p>No data to display.</p>;
  }

  const handleDelete = async (value) => {
    try {
      await deleteApiCall(URL.groupCompany, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: `Group is successfully deleted`,
      });
      navigate("/master/group-company");
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting Group: ${err.message}`,
      });
    }
  };

  return (
    <>
      <Box
        component="form"
        style={{ width: "90%", padding: "0 10%" }}
        //   onSubmit={groupForm.onSubmit(handleForm)}
      >
        <Group justify="space-between">
          <Text fw={500} my={"md"}>
            View Group
          </Text>
          <Group
            // w={"50%"}
            gap={50}
            //   style={{marginLeft:20}}
          >
            <SegmentedControl
              size="xs"
              value={viewData.status}
              data={STATUS_OPTIONS}
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

            <Button
              size="xs"
              w={100}
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              c={"#105476"}
              variant="outline"
              leftSection={<IconEdit size={16} />}
              onClick={() =>
                navigate("/master/group-company-edit", {
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
              label="Group Code"
              withAsterisk
              value={viewData?.group_code}
              w={200}
            />
          </Box>
          <Box>
            <TextInput
              label="Group Name"
              w={200}
              withAsterisk
              value={viewData?.group_name}
            />
          </Box>
        </Group>

        <Stack justify="space-between" mt={"30%"}>
          <Divider my="md" />
          <Flex gap="sm" justify="space-between" align="center" w="100%">
            <Popover
              opened={opened}
              //   onChange={open}
              width={240}
              position="right-start"
              offset={15}
              clickOutsideEvents={["mouseup", "touchend"]}
              radius={"md"}
            >
              <Popover.Target>
                <Button
                  //   opened={opened}
                  onClick={open}
                  w={120}
                  styles={{
                    root: {
                      color: "#105476",
                      borderColor: "red",
                    },
                  }}
                  c={"red"}
                  variant="outline"
                  leftSection={<IconTrash size={16} />}
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
                  Are you sure!<br></br>
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
              styles={{
                root: {
                  color: "#105476",
                  borderColor: "#105476",
                },
              }}
              c={"#105476"}
              variant="outline"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate("/master/group-company")}
            >
              Back
            </Button>
          </Flex>
        </Stack>
      </Box>
    </>
  );
}

export default GroupCompanyView;
