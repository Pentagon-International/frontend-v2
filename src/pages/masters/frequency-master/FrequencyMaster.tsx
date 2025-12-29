import { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Group,
  Menu,
  Popover,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconChevronDown,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilterOff,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type FrequencyMasterType = {
  id: number;
  frequency_name: string;
  status: "ACTIVE" | "INACTIVE";
};

export default function FrequencyMaster() {
  const [data, setData] = useState<FrequencyMasterType[]>([]);
  const navigate = useNavigate();
  const location = useLocation(); // ✅ to detect refresh state

  const fetchData = async () => {
    try {
      const response = await getAPICall(URL.frequency, API_HEADER);
      setData(response || []);
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while fetching data: ${err}`,
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, [location.state?.refresh]); // ✅ refresh on form submit

  const handleDelete = async (value: FrequencyMasterType) => {
    try {
      await deleteApiCall(URL.frequency, API_HEADER, value);
      await fetchData();
      ToastNotification({
        type: "success",
        message: "Frequency Master deleted successfully",
      });
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting: ${err.message}`,
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<FrequencyMasterType>[]>(() => [
    {
      accessorKey: "sno",
      header: "S.No",
      size: 60,
      minSize: 50,
      maxSize: 70,
      enableColumnFilter: false,
      enableSorting: false,
    },
    {
      accessorKey: "frequency_name",
      header: "Frequency Name",
    },
    {
      accessorKey: "status",
      header: "Status",
      Cell: ({ row, cell }) => {
        const value = cell.getValue<"ACTIVE" | "INACTIVE">();

        return (
          <Flex justify="space-between" align="center">
            <Badge
              color={value === "ACTIVE" ? "green" : "red"}
              variant="light"
              size="sm"
              radius="sm"
              px={8}
            >
              {value}
            </Badge>

            <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  icon={<IconEye size={16} color="#105476" />}
                  onClick={() =>
                    navigate("/master/frequency-view", {
                      state: row.original,
                    })
                  }
                >
                  View
                </Menu.Item>
                <Menu.Item
                  icon={<IconEdit size={16} color="#105476" />}
                  onClick={() =>
                    navigate("/master/frequency-edit", {
                      state: row.original,
                    })
                  }
                >
                  Edit
                </Menu.Item>
                <Menu.Divider />
                <Popover width={240} position="bottom-end" radius="md">
                  <Popover.Target>
                    <Menu.Item icon={<IconTrash size={16} color="red" />}>
                      Delete
                    </Menu.Item>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Text size="sm" fw={500}>
                      Are you sure you want to delete?
                    </Text>
                    <Group mt="xs">
                      <Button
                        variant="outline"
                        color="#105476"
                        size="xs"
                        onClick={() => {}}
                      >
                        Cancel
                      </Button>
                      <Button
                        color="red"
                        size="xs"
                        onClick={() => handleDelete(row.original)}
                      >
                        Yes, Delete
                      </Button>
                    </Group>
                  </Popover.Dropdown>
                </Popover>
              </Menu.Dropdown>
            </Menu>
          </Flex>
        );
      },
    },
  ], [navigate]);

  const table = useMantineReactTable({
    columns,
    data,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: true,
    initialState: { pagination: { pageSize: 25, pageIndex: 0 } },
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600}>
          Frequency Master List
        </Text>

        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="Search"
            leftSection={<IconSearch size={16} />}
            style={{ width: 350, height: 32, fontSize: 14 }}
            radius="sm"
            size="xs"
          />

          <Button
            disabled
            variant="default"
            leftSection={<IconFilterOff size={16} />}
            size="xs"
          >
            Clear Filters
          </Button>

          <Menu shadow="md" width={160}>
            <Menu.Target>
              <Button
                variant="outline"
                rightSection={<IconChevronDown size={16} />}
                size="xs"
                color="#105476"
              >
                Download
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item>CSV</Menu.Item>
              <Menu.Item>Excel</Menu.Item>
              <Menu.Item>PDF</Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Button
            variant="outline"
            leftSection={<IconUpload size={16} />}
            size="xs"
            color="#105476"
          >
            Bulk Upload
          </Button>

          <Button
            color="#105476"
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={() => navigate("/master/frequency-new")}
          >
            Create New
          </Button>
        </Group>
      </Group>

      <MantineReactTable table={table} />
    </Card>
  );
}
