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
import { API_HEADER } from "../../../store/storeKeys";
import { URL } from "../../../api/serverUrls";

type ContainerType = {
  code: string;
  name: string;
  type: string;
  maxloadvolume: string;
  maxloadweight: string;
  status: "ACTIVE" | "INACTIVE";
};

export default function ContainerType() {
  const [data, setData] = useState<ContainerType[]>([]);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const response = await getAPICall(URL.containerType, API_HEADER);
      setData(response);
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while fetching data: ${err}`,
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (row: ContainerType) => {
    try {
      await deleteApiCall("containerType", API_HEADER, row);
      await fetchData();
      ToastNotification({
        type: "success",
        message: `Container Type deleted successfully`,
      });
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err?.message}`,
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<ContainerType>[]>(() => [
    { accessorKey: "sno", header: "S.No", size: 60, minSize: 50, maxSize: 70, enableColumnFilter: false, enableSorting: false },
    { accessorKey: "container_code", header: "Code", size: 100 },
    { accessorKey: "container_name", header: "Name", size: 150 },
    { accessorKey: "container_type", header: "Type", size: 120 },
    { accessorKey: "max_load_volume", header: "Max Load Volume", size: 150 },
    { accessorKey: "max_load_weight", header: "Max Load Weight", size: 150 },
    {
      accessorKey: "status",
      header: "Status",
      size: 100,
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
                <Box px="sm" py={4}>
                  <UnstyledButton
                    onClick={() =>
                      navigate("/master/container-type-view", {
                        state: row.original,
                      })
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
                      navigate("/master/container-type-edit", {
                        state: row.original,
                      })
                    }
                  >
                    <Group gap="sm">
                      <IconEdit size={16} color="#105476" />
                      <Text size="sm">Edit</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                <Menu.Divider />
                <Popover width={240} position="left-start" radius="md" withArrow>
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
                      Are you sure? <br /> Do you want to delete this?
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
  ], [navigate]);

  const table = useMantineReactTable({
    columns,
    data,
    enablePagination: true,
    enableColumnFilters: false,
    enableSorting: false,
    enableColumnActions: false,
    enableTopToolbar: false,
    enableBottomToolbar: true,
    initialState: { pagination: { pageSize: 25, pageIndex: 0 } },
    mantinePaperProps: { shadow: "sm", p: "md", radius: "md" },
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantineTableHeadCellProps: { style: { fontSize: "12px", padding: "6px 12px" } },
    mantineTableBodyCellProps: { style: { fontSize: "13px", padding: "8px 12px" } },
    mantineTableContainerProps: { style: { fontSize: "13px" } },
    mantinePaginationProps: { rowsPerPageOptions: ["5", "10"], withEdges: false },
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600}>
          Container Type List
        </Text>
        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="Search"
            leftSection={<IconSearch size={16} />}
            style={{ width: 300 }}
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
              <Menu.Item onClick={() => console.log("Download CSV")}>CSV</Menu.Item>
              <Menu.Item onClick={() => console.log("Download Excel")}>Excel</Menu.Item>
              <Menu.Item onClick={() => console.log("Download PDF")}>PDF</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button
            variant="outline"
            leftSection={<IconUpload size={16} />}
            size="xs"
            color="#105476"
            onClick={() => navigate("/container-type-bulk-upload")}
          >
            Bulk Upload
          </Button>
          <Button
            color="#105476"
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={() => navigate("/master/container-type-new")}
          >
            Create New
          </Button>
        </Group>
      </Group>
      <MantineReactTable table={table} />
    </Card>
  );
}
