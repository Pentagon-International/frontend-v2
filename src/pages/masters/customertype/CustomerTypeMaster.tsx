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
import { useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { URL } from "../../../api/serverUrls";

type CustomerType = {
  id: number;
  customer_type_name: string;
  status: "ACTIVE" | "INACTIVE";
};

export default function CustomerTypeMaster() {
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerType[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await getAPICall(URL.customerType, API_HEADER);
      setData(response || []);
    } catch (err) {
      ToastNotification({
        type: "error",
        message: "Failed to fetch customer types",
      });
    }
  };

  const handleDelete = async (item: CustomerType) => {
    try {
      await deleteApiCall(URL.customerType, API_HEADER, item);
      fetchData();
      ToastNotification({
        type: "success",
        message: "Customer type deleted successfully",
      });
    } catch (err) {
      ToastNotification({
        type: "error",
        message: "Failed to delete customer type",
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<CustomerType>[]>(() => [
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
      accessorKey: "customer_type_name",
      header: "Customer Type Name",
    },
    {
      accessorKey: "status",
      header: "Status",
      Cell: ({ cell, row }) => {
        const value = cell.getValue<"ACTIVE" | "INACTIVE">();
        return (
          <Flex justify="space-between" align="center">
            <Badge
              variant="light"
              color={value === "ACTIVE" ? "green" : "red"}
              size="sm"
              radius="sm"
            >
              {value === "ACTIVE" ? "Active" : "Inactive"}
            </Badge>

            <Menu position="bottom-end" shadow="sm" radius="md" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEye size={16} color="#105476" />}
                  onClick={() =>
                    navigate("/master/customer-type-view", {
                      state: row.original,
                    })
                  }
                >
                  View
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconEdit size={16} color="#105476" />}
                  onClick={() =>
                    navigate("/master/customer-type-edit", {
                      state: row.original,
                    })
                  }
                >
                  Edit
                </Menu.Item>
                <Popover width={240} position="bottom-end" radius="md">
                  <Popover.Target>
                    <Menu.Item leftSection={<IconTrash size={16} color="red" />}>
                      Delete
                    </Menu.Item>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Text size="sm" fw={700} color="red">
                      Confirm Delete
                    </Text>
                    <Text size="sm">Are you sure you want to delete?</Text>
                    <Group mt="xs">
                      <Button variant="outline" size="xs">
                        Not now
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
  ], []);

  const table = useMantineReactTable({
    columns,
    data,
    enableSorting: false,
    enableTopToolbar: false,
    enableColumnFilters: false,
    enableColumnActions: false,
    initialState: { pagination: { pageSize: 10, pageIndex: 0 } },
    mantinePaginationProps: {
      rowsPerPageOptions: ["10", "25", "50"],
    },
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={600}>List of Customer Type</Text>
        <Group gap="sm">
          <TextInput
            placeholder="Search"
            leftSection={<IconSearch size={16} />}
            style={{ width: 240 }}
            radius="sm"
            size="xs"
          />
          <Button
            variant="default"
            leftSection={<IconFilterOff size={16} />}
            size="xs"
            disabled
          >
            Clear Filters
          </Button>
          <Menu shadow="md" width={150}>
            <Menu.Target>
              <Button
                variant="outline"
                rightSection={<IconChevronDown size={16} />}
                size="xs"
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
          >
            Bulk Upload
          </Button>
          <Button
            size="xs"
            color="#105476"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate("/master/customer-type-new")}
          >
            Create New
          </Button>
        </Group>
      </Group>
      <MantineReactTable table={table} />
    </Card>
  );
}
