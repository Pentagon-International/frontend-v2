import { useMemo, useState } from "react";
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
  Center,
  Loader,
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
import { deleteApiCall } from "../../../service/deleteApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";

type PortMaster = {
  port_code: string;
  port_name: string;
  transport_mode: string;
  country_name: string;
  status: "ACTIVE" | "INACTIVE";
};

export default function PortMasterList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch port data with React Query
  const {
    data: portData = [],
    isLoading: portLoading,
    error: portError,
    refetch: refetchPorts,
  } = useQuery({
    queryKey: ["ports"],
    queryFn: async () => {
      try {
        const response = await apiCallProtected.get(
          `${URL.portMaster}?index=0&limit=10`
        );

        const data = response as any;
        if (data && Array.isArray(data.data)) {
          return data.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching port data:", error);
        throw error; // Let React Query handle the error
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const handleDelete = async (value: PortMaster) => {
    try {
      setIsDeleting(true);
      await deleteApiCall(URL.portMaster, API_HEADER, value);
      ToastNotification({ type: "success", message: "Port deleted" });
      // Refresh the data using React Query
      refetchPorts();
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting port: ${err}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Define columns before any conditional returns
  const columns = useMemo<MRT_ColumnDef<PortMaster>[]>(
    () => [
      { accessorKey: "sno", header: "S.No", size: 60, minSize: 50, maxSize: 70, enableColumnFilter: false, enableSorting: false },
      { accessorKey: "port_code", header: "Port Code", size: 100 },
      { accessorKey: "port_name", header: "Port Name", size: 200 },
      { accessorKey: "transport_mode", header: "Transport Mode", size: 120 },
      { accessorKey: "country", header: "Country", size: 120 },
      {
        accessorKey: "status",
        header: "Status",
        size: 80,
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
              <Menu
                withinPortal
                position="bottom-end"
                shadow="sm"
                radius={"md"}
              >
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray">
                    <IconDotsVertical size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/master/port-view", { state: row.original })
                      }
                    >
                      <Group gap={"sm"}>
                        <IconEye size={16} style={{ color: "#105476" }} />
                        <Text size="sm">View</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                  <Menu.Divider />
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/master/port-edit", { state: row.original })
                      }
                    >
                      <Group gap={"sm"}>
                        <IconEdit size={16} style={{ color: "#105476" }} />
                        <Text size="sm">Edit</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                  <Menu.Divider />
                  <Popover width={240} position="bottom-end" radius={"md"}>
                    <Popover.Target>
                      <Box px={10} py={5}>
                        <UnstyledButton>
                          <Group gap={"sm"}>
                            <IconTrash color="red" size={18} />
                            <Text size="sm">Delete</Text>
                          </Group>
                        </UnstyledButton>
                      </Box>
                    </Popover.Target>
                    <Popover.Dropdown>
                      <Group mb={5} gap={"xs"}>
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
                      <Group mt={10} gap={"lg"}>
                        <Button variant="outline" color="#105476" size="xs">
                          Not now
                        </Button>
                        <Button
                          size="xs"
                          color="#FF0004"
                          style={{ width: "100px" }}
                          onClick={() => handleDelete(row.original)}
                          loading={isDeleting}
                          disabled={isDeleting}
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
    ],
    [navigate, isDeleting, handleDelete]
  );

  // Define table configuration before any conditional returns
  const table = useMantineReactTable({
    columns,
    data: portData,
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
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
      },
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
      },
    },
    mantinePaginationProps: {
      rowsPerPageOptions: ["5", "10"],
      withEdges: false,
    },
  });

  // Show loading state
  if (portLoading) {
    return (
      <Center py="xl">
        <Loader size="lg" color="#105476" />
      </Center>
    );
  }

  // Show error state
  if (portError) {
    return (
      <Center py="xl">
        <Text c="red" size="lg">
          Error loading port data. Please try refreshing the page.
        </Text>
      </Center>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600}>
          Port Master List
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
            variant="outline"
            leftSection={<IconFilterOff size={16} />}
            size="xs"
            onClick={() => refetchPorts()}
          >
            Refresh
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
            onClick={() => navigate("/master/port-new")}
          >
            Create New
          </Button>
        </Group>
      </Group>
      <MantineReactTable table={table} />
    </Card>
  );
}
