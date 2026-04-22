import React, { useEffect, useMemo, useState } from "react";
import { ToastNotification } from "../../components";
import { getAPICall } from "../../service/getApiCall";
import { API_HEADER } from "../../store/storeKeys";
import { URL } from "../../api/serverUrls";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Card,
  TextInput,
  Box,
  ActionIcon,
  Menu,
  UnstyledButton,
  Badge,
  Flex,
} from "@mantine/core";
import {
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconEyeSpark,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { Outlet, useNavigate } from "react-router-dom";

type Tariff = {
  id: number;
  origin_name: string;
  destination_name: string;
  valid_from: string;
  valid_to: string;
  status?: string;
  tariff_charges: any[];
  carriers: string;
  customers: string;
};

function Tariff() {
  const [data, setData] = useState<Tariff[]>([]);
  const [tableData, setTableData] = useState<Tariff[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      // Use a mock data structure since tariff URL is not available
      // In a real implementation, you would use the actual API endpoint
      const mockResponse = [
        {
          id: 1,
          origin_name: "Mumbai Port",
          destination_name: "Singapore Port",
          valid_from: "2024-01-01",
          valid_to: "2024-12-31",
          status: "ACTIVE",
          tariff_charges: [
            { carrier: "Maersk", customer_name: "ABC Corp" },
            { carrier: "MSC", customer_name: "XYZ Ltd" },
          ],
        },
        {
          id: 2,
          origin_name: "Chennai Port",
          destination_name: "Dubai Port",
          valid_from: "2024-01-01",
          valid_to: "2024-12-31",
          status: "ACTIVE",
          tariff_charges: [{ carrier: "CMA CGM", customer_name: "DEF Inc" }],
        },
      ];

      console.log("tariff response val=", mockResponse);
      const processedData = mockResponse.map((item: any) => ({
        ...item,
        carriers: [
          ...new Set(item.tariff_charges.map((c: any) => c.carrier)),
        ].join(", "),
        customers: [
          ...new Set(item.tariff_charges.map((c: any) => c.customer_name)),
        ].join(", "),
      }));
      console.log("processedData----", processedData);

      setData(processedData);
      setTableData(processedData);
    } catch (err) {
      ToastNotification({
        type: "error",
        message: `Error while fetching data: ${err}`,
      });
    }
  }

  // Filter data based on local search term
  const filteredTableData = useMemo<Tariff[]>(() => {
    if (!localSearchTerm.trim()) {
      return tableData;
    }

    const searchLower = localSearchTerm.toLowerCase();

    return tableData.filter((item) => {
      // Search in all relevant fields
      const originName = item.origin_name?.toLowerCase() || "";
      const destinationName = item.destination_name?.toLowerCase() || "";
      const carriers = item.carriers?.toLowerCase() || "";
      const customers = item.customers?.toLowerCase() || "";
      const validFrom = item.valid_from?.toLowerCase() || "";
      const validTo = item.valid_to?.toLowerCase() || "";
      const status = item.status?.toLowerCase() || "";

      // Check if search term matches any of these fields
      return (
        originName.includes(searchLower) ||
        destinationName.includes(searchLower) ||
        carriers.includes(searchLower) ||
        customers.includes(searchLower) ||
        validFrom.includes(searchLower) ||
        validTo.includes(searchLower) ||
        status.includes(searchLower)
      );
    });
  }, [tableData, localSearchTerm]);

  const columns = useMemo<MRT_ColumnDef<Tariff>[]>(
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
        accessorKey: "origin_name",
        header: "Origin Name",
        size: 120,
      },
      {
        accessorKey: "destination_name",
        header: "Destination",
        size: 120,
      },
      {
        accessorKey: "carriers",
        header: "Carrier",
        size: 150,
        Cell: ({ row }) => {
          const carriers = row.original.carriers;
          return carriers ? (
            <Text size="sm" style={{ wordBreak: "break-word" }}>
              {carriers}
            </Text>
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "customers",
        header: "Customer Name",
        size: 150,
        Cell: ({ row }) => {
          const customers = row.original.customers;
          return customers ? (
            <Text size="sm" style={{ wordBreak: "break-word" }}>
              {customers}
            </Text>
          ) : (
            "—"
          );
        },
      },
      {
        accessorKey: "valid_from",
        header: "Valid From",
        size: 100,
      },
      {
        accessorKey: "valid_to",
        header: "Valid To",
        size: 100,
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 80,
        Cell: ({ row }) => {
          const status = row.original.status;
          if (!status) return "—";

          return (
            <Badge
              color={status === "ACTIVE" ? "green" : "red"}
              variant="light"
              size="sm"
              radius="sm"
            >
              {status}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Action",
        size: 80,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-end" shadow="sm" radius={"md"}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    navigate("/tariff-create", {
                      state: {
                        ...row.original,
                        actionType: "view",
                      },
                    })
                  }
                >
                  <Group gap={"sm"}>
                    <IconEyeSpark size={16} style={{ color: "#105476" }} />
                    <Text size="sm">View Tariff</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton
                  onClick={() =>
                    navigate("/tariff-create", {
                      state: {
                        ...row.original,
                        actionType: "edit",
                      },
                    })
                  }
                >
                  <Group gap={"sm"}>
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text size="sm">Edit Tariff</Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate]
  );

  const table = useMantineReactTable({
    columns,
    data: filteredTableData,
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
        border: "none",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
        border: "none",
        borderBottom: "none",
        backgroundColor: "white",
      },
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
      },
    },
    mantinePaginationProps: {
      rowsPerPageOptions: ["5", "10", "25"],
      withEdges: false,
    },
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600} c={"#105476"}>
          Lists of Tariffs
        </Text>

        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="Search tariffs (origin, destination, carrier, customer, dates...)"
            leftSection={<IconSearch size={16} />}
            style={{ width: 400, height: 32, fontSize: 14 }}
            radius="sm"
            size="xs"
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
          />

          <Button
            color={"#105476"}
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={() => navigate("/tariff-create")}
          >
            Create New
          </Button>
        </Group>
      </Group>

      {/* Search results summary */}
      {localSearchTerm && (
        <Box mb="md">
          <Text size="sm" c="dimmed">
            Showing {filteredTableData.length} of {tableData.length} results
            {localSearchTerm && ` for "${localSearchTerm}"`}
          </Text>
        </Box>
      )}

      {/* Table */}
      {tableData.length === 0 ? (
        <Box p="xl" style={{ textAlign: "center" }}>
          <Text c="dimmed">No tariffs found</Text>
        </Box>
      ) : (
        <MantineReactTable table={table} />
      )}

      <Outlet />
    </Card>
  );
}

export default Tariff;
