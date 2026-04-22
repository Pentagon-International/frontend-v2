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
import { deleteApiCall } from "../../../service/deleteApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { ToastNotification } from "../../../components";

type CustomerTypeData = {
  id: number;
  customer_type_name: string;
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function CustomerTypeView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);

  const viewData = location.state as CustomerTypeData;

  const handleDelete = async () => {
    try {
      await deleteApiCall(URL.customerType, API_HEADER, viewData);
      ToastNotification({
        type: "success",
        message: "Customer Type deleted successfully",
      });
      navigate("/master/customer-type");
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting: ${err.message}`,
      });
    }
  };

  return (
    <Box
      component="form"
      style={{ width: "90%", padding: "0 10%" }}
    >
      <Group justify="space-between">
        <Text fw={500} my="md">
          View Customer Type
        </Text>
        <Group gap={40}>
          <SegmentedControl
            value={viewData.status}
            data={STATUS_OPTIONS}
            size="xs"
            radius="sm"
            styles={{
              root: { backgroundColor: "#E4E4E4", width: 150 },
              indicator: { backgroundColor: "#105476" },
              label: {
                color: "#105476",
                "&[data-active]": { color: "#ffffff" },
              },
            }}
          />
          <Button
            size="xs"
            w={100}
            variant="outline"
            color="#105476"
            leftSection={<IconEdit size={16} />}
            onClick={() =>
              navigate("/master/customer-type-edit", {
                state: { ...viewData, from: "view" },
              })
            }
          >
            Edit
          </Button>
        </Group>
      </Group>

      <TextInput
        label="Customer Type Name"
        value={viewData.customer_type_name}
        withAsterisk
        w={250}
        mb="lg"
        readOnly
      />

      <Stack mt="30%">
        <Divider my="md" />
        <Flex justify="space-between" align="center" w="100%">
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
                color="red"
                variant="outline"
                leftSection={<IconTrash size={16} />}
              >
                Delete
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Group mb={5}>
                <IconTrash color="red" size={16} />
                <Text size="sm" fw={700} color="red">
                  Delete
                </Text>
              </Group>
              <Text size="sm" mb="xs">
                Are you sure?<br />
                Do you want to delete this?
              </Text>
              <Group mt={10} gap="lg">
                <Button variant="outline" color="#105476" size="xs" onClick={close}>
                  Not now
                </Button>
                <Button
                  size="xs"
                  color="#FF0004"
                  style={{ width: 100 }}
                  onClick={() => {
                    handleDelete();
                    close();
                  }}
                >
                  Yes, Delete
                </Button>
              </Group>
            </Popover.Dropdown>
          </Popover>

          <Button
            variant="outline"
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/customer-type")}
          >
            Back
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}

export default CustomerTypeView;
