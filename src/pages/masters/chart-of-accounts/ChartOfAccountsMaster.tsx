import { useMemo, useState, useEffect } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
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
  Text,
  UnstyledButton,
  Center,
  Loader,
  Stack,
  Select,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";

type ChartOfAccountsMaster = {
  id?: string;
  account_code?: string;
  account_name?: string;
  account_type?: string;
  status?: "ACTIVE" | "INACTIVE";
};

export default function ChartOfAccountsMasterList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({
      pageIndex: 0,
      pageSize: newPageSize,
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: newPage - 1, // Convert to 0-based index
    }));
  };

  const {
    data: chartOfAccountsData = [],
    isLoading: chartOfAccountsLoading,
    error: chartOfAccountsError,
    refetch: refetchChartOfAccounts,
  } = useQuery({
    queryKey: ["chart-of-accounts", pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      try {
        const index = pagination.pageIndex * pagination.pageSize;
        const response = await apiCallProtected.post(
          `${URL.chartOfAccountsFilter}?index=${index}&limit=${pagination.pageSize}`,
          {}
        );

        const data = response as any;
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching chart of accounts data:", error);
        setTotalRecords(0);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Refetch data when navigating from create/edit pages
  useEffect(() => {
    if (location.state?.refreshData) {
      refetchChartOfAccounts();
      // Clear the refresh flag
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.refreshData, refetchChartOfAccounts, navigate, location.pathname]);

  const columns = useMemo<MRT_ColumnDef<ChartOfAccountsMaster>[]>(
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
      { accessorKey: "account_code", header: "Account Code", size: 120 },
      { accessorKey: "account_name", header: "Account Name", size: 200 },
      { accessorKey: "account_type", header: "Account Type", size: 150 },
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
                        navigate("/master/chart-of-accounts/edit", { state: row.original })
                      }
                    >
                      <Group gap={"sm"}>
                        <IconEdit size={16} style={{ color: "#105476" }} />
                        <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>Edit</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                </Menu.Dropdown>
              </Menu>
            </Flex>
          );
        },
      },
    ],
    [navigate]
  );

  const table = useMantineReactTable({
    columns,
    data: chartOfAccountsData,
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      pagination: { pageSize: 25, pageIndex: 0 },
      columnPinning: { right: ["status"] },
    },
    layoutMode: "grid",
    manualPagination: true,
    onPaginationChange: setPagination,
    rowCount: totalRecords,
    state: {
      pagination,
    },
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
      style: { width: "100%" },
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "md",
      radius: "md",
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "1536px",
        overflow: "auto",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles = {};
      if (column.id === "status") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "30px",
          zIndex: 2,
          borderLeft: "1px solid #F3F3F3",
          boxShadow: "1px -2px 4px 0px #00000040",
        };
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontstyle: "regular",
          fontFamily: "Inter",
          color: "#333740",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      let extraStyles = {};
      if (column.id === "status") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "80px",
          zIndex: 2,
          backgroundColor: "#FBFBFB",
          boxShadow: "0px -2px 4px 0px #00000040",
        };
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          fontstyle: "bold",
          color: "#444955",
          backgroundColor: "#FBFBFB",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid #F3F3F3",
          ...extraStyles,
        },
      };
    },
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
      },
    },
  });

  if (chartOfAccountsLoading) {
    return (
      <Card
        shadow="sm"
        pt="md"
        pb="sm"
        px="lg"
        radius="md"
        withBorder
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          flex: 1,
        }}
      >
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed" style={{ fontFamily: "Inter, sans-serif" }}>
              Loading chart of accounts data...
            </Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  if (chartOfAccountsError) {
    return (
      <Card
        shadow="sm"
        pt="md"
        pb="sm"
        px="lg"
        radius="md"
        withBorder
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          flex: 1,
        }}
      >
        <Center py="xl">
          <Text c="red" size="lg" style={{ fontFamily: "Inter, sans-serif" }}>
            Error loading chart of accounts data. Please try refreshing the page.
          </Text>
        </Center>
      </Card>
    );
  }

  return (
    <Card
      shadow="sm"
      pt="md"
      pb="sm"
      px="lg"
      radius="md"
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        flex: 1,
      }}
    >
      <Box mb="md">
        <Group justify="space-between" align="center">
          <Text
            size="md"
            fw={600}
            c={"#444955"}
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Chart of Accounts Master List
          </Text>

          <Group gap="xs" wrap="nowrap">
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              styles={{
                root: {
                  backgroundColor: "#105476",
                  borderRadius: "4px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontstyle: "semibold",
                  "&:hover": {
                    backgroundColor: "#105476",
                  },
                },
              }}
              onClick={() => navigate("/master/chart-of-accounts/create")}
            >
              Create New
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Table wrapper with flex to take remaining space */}
      <Box style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <MantineReactTable table={table} />
      </Box>

      {/* Custom Pagination Bar */}
      <Group
        w="100%"
        justify="space-between"
        align="center"
        p="xs"
        wrap="nowrap"
        pt="md"
      >
        {/* Left side: Rows per page */}
        <Group gap="sm" align="center" wrap="nowrap">
          <Text size="sm" c="dimmed">
            Rows per page
          </Text>
          <Select
            size="xs"
            data={["10", "25", "50"]}
            value={String(pagination.pageSize)}
            onChange={(val) => {
              if (!val) return;
              handlePageSizeChange(Number(val));
            }}
            w={110}
            styles={{ input: { fontSize: 12, height: 30 } } as any}
          />
          <Text size="sm" c="dimmed">
            {(() => {
              const total = totalRecords || 0;
              if (total === 0) return "0–0 of 0";
              const start = pagination.pageIndex * pagination.pageSize + 1;
              const end = Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                total
              );
              return `${start}–${end} of ${total}`;
            })()}
          </Text>
        </Group>

        {/* Right side: Page controls */}
        <Group gap="xs" align="center" wrap="nowrap" pr={50}>
          <ActionIcon
            variant="default"
            size="sm"
            onClick={() =>
              handlePageChange(Math.max(1, pagination.pageIndex + 1))
            }
            disabled={pagination.pageIndex === 0}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text size="sm" ta="center" style={{ width: 26 }}>
            {pagination.pageIndex + 1}
          </Text>
          <Text size="sm" c="dimmed">
            of {Math.max(1, Math.ceil(totalRecords / pagination.pageSize))}
          </Text>
          <ActionIcon
            variant="default"
            size="sm"
            onClick={() => {
              const totalPages = Math.max(
                1,
                Math.ceil(totalRecords / pagination.pageSize)
              );
              handlePageChange(
                Math.min(totalPages, pagination.pageIndex + 2)
              );
            }}
            disabled={(() => {
              const totalPages = Math.max(
                1,
                Math.ceil(totalRecords / pagination.pageSize)
              );
              return pagination.pageIndex + 1 >= totalPages;
            })()}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Card>
  );
}
