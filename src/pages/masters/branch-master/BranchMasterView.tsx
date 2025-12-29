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

type BranchData = {
  id: number;
  branch_code: string;
  branch_name: string;
  company_name: string;
  address: string;
  city: string;
  state: string;
  pin_code: string;
  status: "ACTIVE" | "INACTIVE";
};

const STATUS_OPTIONS = [
  { label: "Active", value: "ACTIVE" },
  { label: "Inactive", value: "INACTIVE" },
];

function BranchMasterView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { open, close }] = useDisclosure(false);
  const viewData = location.state as BranchData | undefined;

  if (!viewData) {
    return <p>No data to display.</p>;
  }

  const handleDelete = async (value: BranchData) => {
    try {
      await deleteApiCall(URL.branchMaster, API_HEADER, value);
      ToastNotification({
        type: "success",
        message: `Branch deleted successfully`,
      });
      navigate("/master/branch");
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Delete failed: ${err.message}`,
      });
    }
  };

  return (
    <Box style={{ width: "90%", padding: "0 10%" }}>
      <Group justify="space-between">
        <Text fw={500} my={"md"}>
          View Branch
        </Text>
        <Group gap={40}>
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
            variant="outline"
            color="#105476"
            leftSection={<IconEdit size={16} />}
            onClick={() =>
              navigate("/master/branch-master-edit", {
                state: { ...viewData, from: "view" },
              })
            }
          >
            Edit
          </Button>
        </Group>
      </Group>

      <Group mb="md" gap={80}>
        <Box>
          <TextInput label="Branch Code" value={viewData.branch_code} w={220} />
        </Box>
        <Box>
          <TextInput label="Branch Name" value={viewData.branch_name} w={220} />
        </Box>
        <Box>
          <TextInput label="Company Name" value={viewData.company_name} w={220} />
        </Box>
      </Group>

      <Group mb="md" gap={80}>
        <Box>
          <TextInput label="Address" value={viewData.address} w={220} />
        </Box>
        <Box>
          <TextInput label="City" value={viewData.city} w={220} />
        </Box>
        <Box>
          <TextInput label="State" value={viewData.state} w={220} />
        </Box>
        <Box>
          <TextInput label="Pin Code" value={viewData.pin_code} w={220} />
        </Box>
      </Group>

      <Stack justify="space-between" mt={"10%"}>
        <Divider my="md" />
        <Flex justify="space-between" align="center">
          <Popover
            opened={opened}
            width={240}
            position="right-start"
            offset={15}
            radius={"md"}
          >
            <Popover.Target>
              <Button
                onClick={open}
                w={120}
                variant="outline"
                color="red"
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
                Are you sure? This action cannot be undone.
              </Text>
              <Group mt={10} gap={"lg"}>
                <Button variant="outline" color="#105476" size="xs" onClick={close}>
                  Cancel
                </Button>
                <Button
                  size="xs"
                  color="red"
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
            color="#105476"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/master/branch")}
          >
            Back
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}

export default BranchMasterView;
