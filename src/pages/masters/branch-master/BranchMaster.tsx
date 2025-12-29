import { useMemo, useCallback, useState } from "react";
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
  Center,
  Flex,
  Group,
  Loader,
  Menu,
  Popover,
  Select,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ToastNotification } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { URL } from "../../../api/serverUrls";
import { API_HEADER } from "../../../store/storeKeys";

type Branch = {
  id: number;
  branch_code: string;
  branch_name: string;
  company_name: string;
  city: string;
  city_name: string;
  state: string;
  state_name: string;
  country: string;
  country_name: string;
  pin_code: string;
  status: "ACTIVE" | "INACTIVE";
};

type BranchApiResponse = {
  success: boolean;
  message: string;
  data: Branch[];
  total: number;
  index: number;
  limit: number;
};

export default function BranchMaster() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [rowCount, setRowCount] = useState(0);

  // Fetch branches data using useQuery with server-side pagination
  const { data: branches = [] } = useQuery({
    queryKey: ["branches", pageIndex, pageSize],
    queryFn: async () => {
      try {
        const url = `${URL.branchMaster}?index=${pageIndex}&limit=${pageSize}`;
        const response = (await getAPICall(url, API_HEADER)) as
          | BranchApiResponse
          | Branch[];

        // Handle the API response structure
        if (
          response &&
          typeof response === "object" &&
          "success" in response &&
          response.success &&
          Array.isArray(response.data)
        ) {
          // Set pagination details from response
          setRowCount(response.total);
          return response.data;
        }

        // Fallback for different response structure
        if (Array.isArray(response)) {
          setRowCount(response.length);
          return response;
        }

        return [];
      } catch (error) {
        console.error("Error fetching branches:", error);
        ToastNotification({
          type: "error",
          message: `Error while fetching data: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const handleDelete = useCallback(
    async (branch: Branch) => {
      try {
        await deleteApiCall(URL.branchMaster, API_HEADER, { id: branch.id });
        // Invalidate and refetch branches data
        await queryClient.invalidateQueries({ queryKey: ["branches"] });

        // If we're on a page that might be empty after deletion, go to previous page
        if (branches.length === 1 && pageIndex > 0) {
          setPageIndex((prevIndex) => prevIndex - 1);
        } else if (branches.length === 1 && pageIndex === 0) {
          // If deleting the only item on first page, reset to first page
          setPageIndex(0);
        }
        ToastNotification({
          type: "success",
          message: `Branch is successfully deleted`,
        });
      } catch (err: unknown) {
        ToastNotification({
          type: "error",
          message: `Error while deleting data: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    },
    [queryClient, branches.length, pageIndex]
  );

  const columns = useMemo<MRT_ColumnDef<Branch>[]>(
    () => [
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
        accessorKey: "branch_code",
        header: "Branch Code",
        size: 120,
        minSize: 100,
        maxSize: 150,
      },
      {
        accessorKey: "branch_name",
        header: "Branch Name",
        size: 100,
        minSize: 70,
        maxSize: 150,
      },
      {
        accessorKey: "company_name",
        header: "Company Name",
        size: 180,
        minSize: 150,
        maxSize: 220,
      },
      {
        accessorKey: "country_name",
        header: "Country",
        size: 120,
        minSize: 100,
        maxSize: 150,
      },
      {
        accessorKey: "state_name",
        header: "State",
        size: 150,
        minSize: 120,
        maxSize: 180,
      },
      {
        accessorKey: "city_name",
        header: "City",
        size: 150,
        minSize: 120,
        maxSize: 180,
      },
      {
        accessorKey: "pin_code",
        header: "Pin Code",
        size: 100,
        minSize: 80,
        maxSize: 120,
      },
      {
        accessorKey: "status",
        header: "Status",
        Cell: ({ row }) => {
          const value = row.original.status;
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
                  <Box px="sm" py={4}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/master/branch-master-view", {
                          state: row.original,
                        })
                      }
                    >
                      <Group gap={"sm"}>
                        <IconEye size={16} style={{ color: "#105476" }} />
                        <Text size="sm">View</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                  <Menu.Divider />
                  <Box px="sm" py={4}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/master/branch-master-edit", {
                          state: row.original,
                        })
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
                      <Box px="sm" py={4}>
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
                        Are you sure? <br />
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
    [navigate, handleDelete]
  );

  const table = useMantineReactTable({
    columns,
    data: branches,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false, // Disable default pagination
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    manualPagination: true, // Enable server-side pagination
    rowCount: rowCount, // Total number of rows from server
    onPaginationChange: (updater) => {
      const newPagination =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      setPageIndex(newPagination.pageIndex);
      setPageSize(newPagination.pageSize);
    },
    state: {
      pagination: { pageIndex, pageSize },
    },
    initialState: {
      pagination: { pageSize: 25, pageIndex: 0 },
      columnSizing: {
        branch_code: 120,
        branch_name: 100,
        company_name: 180,
        country_name: 120,
        state_name: 150,
        city_name: 150,
        pin_code: 100,
        status: 150,
      },
    },
    mantineLoadingOverlayProps: {
      overlayProps: { style: { position: "absolute" } },
    },
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: { shadow: "sm", p: "md", radius: "md" },
    mantineTableBodyCellProps: {
      style: { padding: "8px 12px", fontSize: "13px" },
    },
    mantineTableHeadCellProps: {
      style: { padding: "6px 12px", fontSize: "12px" },
    },
    mantineTableContainerProps: {
      style: { fontSize: "13px", height: "100%" },
    },
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600}>
          Branch Master List
        </Text>
        <Button
          color="#105476"
          leftSection={<IconPlus size={16} />}
          size="xs"
          onClick={() => navigate("/master/branch-master-new")}
        >
          Create New
        </Button>
      </Group>

      {branches.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">Loading branches...</Text>
          </Stack>
        </Center>
      ) : (
        <>
          <MantineReactTable table={table} />

          {/* Custom Pagination Bar */}
          <Group
            w="100%"
            justify="space-between"
            align="center"
            px="md"
            py="xs"
            style={{ borderTop: "1px solid #e9ecef" }}
            wrap="nowrap"
            mt="xs"
          >
            {/* Rows per page and range */}
            <Group gap="sm" align="center" wrap="nowrap" mt={10}>
              <Text size="sm" c="dimmed">
                Rows per page
              </Text>
              <Select
                size="xs"
                data={["10", "25", "50"]}
                value={String(table.getState().pagination.pageSize)}
                onChange={(val) => {
                  if (!val) return;
                  table.setPageSize(Number(val));
                  table.setPageIndex(0);
                }}
                w={110}
                styles={{ input: { fontSize: 12, height: 30 } }}
              />
              <Text size="sm" c="dimmed">
                {(() => {
                  const { pageIndex, pageSize } = table.getState().pagination;
                  const total = rowCount || 0;
                  if (total === 0) return "0–0 of 0";
                  const start = pageIndex * pageSize + 1;
                  const end = Math.min((pageIndex + 1) * pageSize, total);
                  return `${start}–${end} of ${total}`;
                })()}
              </Text>
            </Group>

            {/* Page controls */}
            <Group gap="xs" align="center" wrap="nowrap" mt={10}>
              <ActionIcon
                variant="default"
                size="sm"
                onClick={() =>
                  table.setPageIndex(
                    Math.max(0, table.getState().pagination.pageIndex - 1)
                  )
                }
                disabled={table.getState().pagination.pageIndex === 0}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <Text size="sm" ta="center" style={{ width: 26 }}>
                {table.getState().pagination.pageIndex + 1}
              </Text>
              <Text size="sm" c="dimmed">
                of{" "}
                {Math.max(
                  1,
                  Math.ceil(
                    (rowCount || 0) / table.getState().pagination.pageSize
                  )
                )}
              </Text>
              <ActionIcon
                variant="default"
                size="sm"
                onClick={() => {
                  const total = rowCount || 0;
                  const totalPages = Math.max(
                    1,
                    Math.ceil(total / table.getState().pagination.pageSize)
                  );
                  table.setPageIndex(
                    Math.min(
                      totalPages - 1,
                      table.getState().pagination.pageIndex + 1
                    )
                  );
                }}
                disabled={(() => {
                  const total = rowCount || 0;
                  const totalPages = Math.max(
                    1,
                    Math.ceil(total / table.getState().pagination.pageSize)
                  );
                  return (
                    table.getState().pagination.pageIndex >= totalPages - 1
                  );
                })()}
              >
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </>
      )}
    </Card>
  );
}
