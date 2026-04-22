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

type FollowUp = {
  id: number;
  name: string;
  type: string;
  followup_days: number;
  status: "ACTIVE" | "INACTIVE";
};

export default function FollowUpMaster() {
  const [data, setData] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const response = await getAPICall(URL.followUpAction, API_HEADER);
      setData(response);
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while fetching data: ${err}`,
      });
    }
  }

  const handleDelete = async (row) => {
    try {
      await deleteApiCall(URL.followUp, API_HEADER, row.id);
      fetchData();
      ToastNotification({
        type: "success",
        message: `Follow-up is successfully deleted`,
      });
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err?.message}`,
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<FollowUp>[]>(() => [
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
      accessorKey: "followup_name",
      header: "Name",
    },
    {
      accessorKey: "callmode_name",
      header: "Type",
    },
    {
      accessorKey: "followup_days",
      header: "Follow Up Days",
    },
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
                <Menu.Item
                  onClick={() =>
                    navigate("/master/follow-up-view", { state: row.original })
                  }
                  leftSection={<IconEye size={16} color="#105476" />}
                >
                  View
                </Menu.Item>
                <Menu.Item
                  onClick={() =>
                    navigate("/master/follow-up-edit", { state: row.original })
                  }
                  leftSection={<IconEdit size={16} color="#105476" />}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => handleDelete(row.original)}
                >
                  Delete
                </Menu.Item>
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
    enableSorting: false,
    enablePagination: true,
    enableTopToolbar: false,
    initialState: { pagination: { pageSize: 25, pageIndex: 0 } },
    mantinePaperProps: { shadow: "sm", p: "md", radius: "md" },
    mantineTableHeadCellProps: { style: { padding: "6px 12px", fontSize: "12px" } },
    mantineTableBodyCellProps: { style: { padding: "8px 12px", fontSize: "13px" } },
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={600} size="md">
          List of Follow-ups
        </Text>
        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="Search"
            leftSection={<IconSearch size={16} />}
            style={{ width: 300 }}
            size="xs"
          />
          <Button
            variant="default"
            size="xs"
            leftSection={<IconFilterOff size={16} />}
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
            size="xs"
            color="#105476"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate("/master/follow-up-new")}
          >
            Create New
          </Button>
        </Group>
      </Group>
      <MantineReactTable table={table} />
    </Card>
  );
}
