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
  IconEyeSpark,
  IconFilterOff,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { API_HEADER } from "../../../store/storeKeys";

type GroupCompany = {
  groupCode: string;
  groupName: string;
  status: "ACTIVE" | "INACTIVE";
};

export default function GroupCompany() {
  const [data, setData] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const response = await getAPICall(URL.groupCompany, API_HEADER);
      // console.log("response val=", response);
      setData(response);
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while fetching data: ${err}`,
      });
    }
  }

  const handleDelete = async (value) => {
    try {
      const res = await deleteApiCall(URL.groupCompany, API_HEADER, value);

      const fetchResult = await fetchData();
      setData(fetchResult);
      ToastNotification({
        type: "success",
        message: `Group is successfully deleted`,
      });
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err?.message}`,
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<GroupCompany>[]>(
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
        accessorKey: "group_code",
        header: "Group Code",
        size: 140,
      },
      {
        accessorKey: "group_name",
        header: "Group Name",
        size: 240,
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 70,
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
                  <Box style={{ padding: "5px 50px 3px 10px" }}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/master/group-company-view", {
                          state: row.original,
                        })
                      }
                      // size={"10"}
                    >
                      <Group gap={"sm"}>
                        <IconEyeSpark
                          size={16}
                          style={{ color: "#105476", marginRight: 6 }}
                        />
                        <Text size="sm">View</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                  <Menu.Divider />

                  <Box style={{ padding: "5px 50px 3px 10px" }}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/master/group-company-edit", {
                          state: row.original,
                        })
                      }
                      // size={"10"}
                    >
                      <Group gap={"sm"}>
                        <IconEdit
                          size={16}
                          style={{ color: "#105476", marginRight: 6 }}
                        />
                        <Text size="sm">Edit</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                  <Menu.Divider />

                  <Popover
                    width={240}
                    position="bottom-end"
                    clickOutsideEvents={["mouseup", "touchend"]}
                    radius={"md"}
                  >
                    <Popover.Target>
                      <Box style={{ padding: "5px 50px 3px 10px" }}>
                        <UnstyledButton
                        // size={"10"}
                        >
                          <Group gap={"sm"}>
                            <IconTrash
                              color="red"
                              size={18}
                              // style={{ marginRight: 4 }}
                            />
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
                        Are you sure!<br></br>
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
    []
  );

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
    // paginationDisplayMode: "pages",
    mantinePaginationProps: {
      rowsPerPageOptions: ["5", "10"],
      withEdges: false, //note: changed from `showFirstLastButtons` in v1.0
    },
    // mantinePaginationProps: {
    //   style: {
    //     display: "flex",
    //     justifyContent: "space-between",
    //     alignItems: "center",
    //     padding: "8px 16px",
    //     flexWrap: "nowrap",
    //     gap: "1rem",
    //     borderTop: "1px solid #f1f1f1",
    //   },
    //   className: "custom-pagination",
    //   radius: "md",
    //   size: "sm",
    //   withControls: true,
    //   withEdges: true,
    // },
  });

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600}>
            Group Companies Lists
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
              //   style={{color:"dimmed"}}
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
              color={"#105476"}
            >
              Bulk Upload
            </Button>

            <Button
              //   variant="filled"
              color={"#105476"}
              leftSection={<IconPlus size={16} />}
              size="xs"
              onClick={() => navigate("/master/group-company-new")}
            >
              Create New
            </Button>
          </Group>
        </Group>
        <MantineReactTable table={table} />
      </Card>
    </>
  );
}
