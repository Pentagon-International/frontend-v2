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
  Select,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconEyeSpark,
  IconFilterOff,
  IconFilterSearch,
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

type CompanyData = {
  id: number;
  company_code: string;
  company_name: string;
  website: string;
  reporting_name: string;
  status: string;
  group_name: string;
};

function Company() {
  const [data, setData] = useState<CompanyData[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const totalPages = Math.ceil(rowCount / pageSize);
  const startItem = pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, rowCount);
  const navigate = useNavigate();

  const fetchData = async (page: number, size: number) => {
    try {
      const data = await getAPICall(`${URL.company}?page=${page}`, API_HEADER);
      // console.log("result check=", data);
      setData(data);
      setRowCount(data.count);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchData(pageIndex + 1, pageSize);
  }, [pageIndex, pageSize]);

  const handleDelete = async (value) => {
    try {
      const res = await deleteApiCall(URL.company, API_HEADER, value);
      const fetchResult = await fetchData(pageIndex + 1, pageSize);

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

  const columns = useMemo<MRT_ColumnDef<CompanyData>[]>(
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
        accessorKey: "company_code",
        header: (
          <Group style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Text size="sm" fw={500}>
              Group Code
            </Text>
            <IconSearch size={16} />
          </Group>
        ),
        size: 150,
      },
      {
        accessorKey: "company_name",
        header: (
          <Group style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Text size="sm" fw={500}>
              Company Name
            </Text>
            <IconSearch size={16} />
          </Group>
        ),
        size: 150,
      },
      {
        accessorKey: "website",
        header: (
          <Group style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Text size="sm" fw={500}>
              Website
            </Text>
            <IconFilterSearch size={16} />
          </Group>
        ),
        size: 150,
      },
      {
        accessorKey: "group_name",
        header: (
          <Group style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Text size="sm" fw={500}>
              Group Company
            </Text>
            <IconFilterSearch size={16} />
          </Group>
        ),
        size: 150,
      },
      {
        accessorKey: "reporting_name",
        header: (
          <Group style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Text size="sm" fw={500}>
              Reporting Name
            </Text>
            <IconSearch size={16} />
          </Group>
        ),
        size: 150,
      },
      {
        accessorKey: "status",
        header: (
          <Group style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Text size="sm" fw={500}>
              Search
            </Text>
            <IconFilterSearch size={16} />
          </Group>
        ),
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
                        navigate("/master/company-view", {
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
                        navigate("/master/company-edit", {
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
    manualPagination: true,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    renderBottomToolbarCustomActions: () => (
      <Group w="100%" justify="space-between" px="md" py="xs">
        {/* Items per page */}
        <Group>
          <Text size="sm" c={"dimmed"}>
            Items per page
          </Text>
          <Select
            value={pageSize.toString()}
            onChange={(val) => {
              setPageSize(Number(val));
              setPageIndex(0);
            }}
            data={["5"]}
            w={80}
          />
          <Text size="sm" c={"dimmed"}>
            {startItem}–{endItem} of {rowCount} items
          </Text>
        </Group>

        {/* Pagination Controls */}
        <Group>
          <ActionIcon
            // onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex === 0}
            // disabled={pageIndex + 1 >= totalPages}
            onClick={() => {
              const newPage = pageIndex - 1;
              setPageIndex(newPage);
              fetchingData(pageIndex + 1, pageSize);
            }}
            variant="default"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Text size="sm" w={20} ta="center">
            {pageIndex + 1}
          </Text>
          <Text size="sm" c="dimmed">
            of {totalPages} pages
          </Text>
          <ActionIcon
            onClick={() => {
              setPageIndex((p) => Math.min(totalPages - 1, p + 1));
              //   handlePaginationNext();
            }}
            disabled={pageIndex === totalPages - 1}
            variant="default"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
      </Group>
    ),
  });

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Text size="md" fw={600} c={"#105476"}>
            Companies Lists
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
              onClick={() => navigate("/master/company-new")}
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
export default Company;
