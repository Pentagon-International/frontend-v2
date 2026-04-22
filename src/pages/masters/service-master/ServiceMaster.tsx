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
  UnstyledButton,
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
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type Service = {
  service_code: string;
  service_name: string;
  transport_mode: string;
  full_groupage: string;
  import_export: string;
  status: "ACTIVE" | "INACTIVE";
};

export default function ServiceMaster() {
  const [data, setData] = useState<Service[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const response = await getAPICall(URL.serviceMaster, API_HEADER);
      setData(response || []);
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while fetching data: ${err}`,
      });
    }
  }

  const handleDelete = async (value: Service) => {
    try {
      await deleteApiCall(URL.serviceMaster, API_HEADER, value);
      await fetchData();
      ToastNotification({
        type: "success",
        message: `Service deleted successfully`,
      });
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting: ${err.message}`,
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<Service>[]>(() => [
    { accessorKey: "sno", header: "S.No", size: 60, minSize: 50, maxSize: 70, enableColumnFilter: false, enableSorting: false },
    { accessorKey: "service_code", header: "Code" },
    { accessorKey: "service_name", header: "Name" },
    { accessorKey: "transport_mode_name", header: "Transport Mode" },
    { accessorKey: "full_groupage", header: "Full/Groupage" },
    { accessorKey: "import_export", header: "Import/Export" },
    {
      accessorKey: "status",
      header: "Status",
      Cell: ({ cell, row }) => {
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
                <Box px="sm" py={4}>
                  <UnstyledButton
                    onClick={() =>
                      navigate("/master/service-view", { state: row.original })
                    }
                  >
                    <Group gap="sm">
                      <IconEye size={16} color="#105476" />
                      <Text size="sm">View</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                <Box px="sm" py={4}>
                  <UnstyledButton
                    onClick={() =>
                      navigate("/master/service-edit", { state: row.original })
                    }
                  >
                    <Group gap="sm">
                      <IconEdit size={16} color="#105476" />
                      <Text size="sm">Edit</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                <Popover width={240} position="bottom-end" radius="md">
                  <Popover.Target>
                    <Box px="sm" py={4}>
                      <UnstyledButton>
                        <Group gap="sm">
                          <IconTrash color="red" size={18} />
                          <Text size="sm">Delete</Text>
                        </Group>
                      </UnstyledButton>
                    </Box>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Group mb={5} gap="xs">
                      <IconTrash color="red" size={16} />
                      <Text size="sm" c="red" fw={700}>
                        Delete
                      </Text>
                    </Group>
                    <Text size="sm" mb="xs">
                      Are you sure you want to delete this?
                    </Text>
                    <Group mt={10} gap="lg">
                      <Button variant="outline" color="#105476" size="xs">
                        Not now
                      </Button>
                      <Button
                        size="xs"
                        color="#FF0004"
                        style={{ width: "100px" }}
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
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: true,
    initialState: { pagination: { pageSize: 25, pageIndex: 0 } },
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: { shadow: "sm", p: "md", radius: "md" },
    mantineTableBodyCellProps: { style: { padding: "8px 12px", fontSize: "13px" } },
    mantineTableHeadCellProps: { style: { padding: "6px 12px", fontSize: "12px" } },
    mantineTableContainerProps: { style: { fontSize: "13px" } },
    mantinePaginationProps: { rowsPerPageOptions: ["5", "10"], withEdges: false },
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600}>
          Service Master List
        </Text>
        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="Search"
            leftSection={<IconSearch size={16} />}
            style={{ width: 350 }}
            radius="sm"
            size="xs"
          />
          <Button disabled variant="default" leftSection={<IconFilterOff size={16} />} size="xs">
            Clear Filters
          </Button>
          <Menu shadow="md" width={160}>
            <Menu.Target>
              <Button variant="outline" rightSection={<IconChevronDown size={16} />} size="xs" color="#105476">
                Download
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item>CSV</Menu.Item>
              <Menu.Item>Excel</Menu.Item>
              <Menu.Item>PDF</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button variant="outline" leftSection={<IconUpload size={16} />} size="xs" color="#105476">
            Bulk Upload
          </Button>
          <Button
            color="#105476"
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={() => navigate("/master/service-new")}
          >
            Create New
          </Button>
        </Group>
      </Group>
      <MantineReactTable table={table} />
    </Card>
  );
}
