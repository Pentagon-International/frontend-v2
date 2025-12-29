import { useMemo, useState, useEffect } from "react";
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
  Center,
  Stack,
  Menu,
  ActionIcon,
  Select,
  Loader,
} from "@mantine/core";
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiCallProtected } from "../../../api/axios";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

// Type definitions
type AirExportJobData = {
  id: number;
  service: string;
  service_type: string;
  origin_agent_code: string | null;
  origin_agent_name: string | null;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  etd: string;
  eta: string;
  atd: string | null;
  ata: string | null;
  carrier_code: string;
  carrier_name: string;
  vessel_name: string | null;
  voyage_number: string | null;
  mbl_number: string | null;
  mbl_date: string | null;
  flightno: string | null;
  mawb_no: string | null;
  mawb_date: string | null;
  ocean_routings?: Array<Record<string, unknown>>;
  housing_details?: Array<Record<string, unknown>>;
  created_by?: string;
  branch_code?: string;
  company_code?: string;
  created_at?: string;
  updated_at?: string;
};

function AirExportJobMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch data using useQuery - filter for Air service
  const {
    data: exportJobData,
    isLoading,
    isFetching,
    refetch: refetchExportJobs,
  } = useQuery<{ data: AirExportJobData[]; total_count: number }>({
    queryKey: ["airExportJobs"],
    queryFn: async () => {
      try {
        const response = await apiCallProtected.post(
          URL.filterJobCreate,
          { filters: { service: "AIR", service_type: "Export" } },
          API_HEADER
        );
        const result = response as unknown as {
          status: boolean;
          message: string;
          data: AirExportJobData[];
          total_count: number;
        };

        // Handle response format: { status, message, data, total_count }
        if (result?.status && Array.isArray(result?.data)) {
          return {
            data: result.data,
            total_count: result.total_count || result.data.length,
          };
        }
        return { data: [], total_count: 0 };
      } catch (error) {
        console.error("Error fetching air export jobs:", error);
        return { data: [], total_count: 0 };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: !!location.state?.refreshData,
  });

  const data = useMemo(() => exportJobData?.data || [], [exportJobData]);
  const totalRecords = useMemo(
    () => exportJobData?.total_count || 0,
    [exportJobData]
  );

  // Refetch when navigating from create page
  useEffect(() => {
    if (location.state?.refreshData) {
      queryClient.invalidateQueries({ queryKey: ["airExportJobs"] });
      refetchExportJobs();
      // Clear the refresh flag
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state?.refreshData,
    navigate,
    location.pathname,
    queryClient,
    refetchExportJobs,
  ]);

  // Columns definition
  const columns = useMemo<MRT_ColumnDef<AirExportJobData>[]>(
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
        accessorKey: "mawb_no",
        header: "MAWB No",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value || "-";
        },
      },
      {
        accessorKey: "origin_agent_name",
        header: "Origin Agent",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          return value || "-";
        },
      },
      {
        accessorKey: "origin_name",
        header: "Origin",
        size: 150,
      },
      {
        accessorKey: "destination_name",
        header: "Destination",
        size: 150,
      },
      {
        accessorKey: "etd",
        header: "ETD",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) return "-";
          try {
            return dayjs.utc(value).local().format("DD-MM-YYYY HH:mm");
          } catch {
            return value;
          }
        },
      },
      {
        accessorKey: "eta",
        header: "ETA",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null>();
          if (!value) return "-";
          try {
            return dayjs.utc(value).local().format("DD-MM-YYYY HH:mm");
          } catch {
            return value;
          }
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => (
          <Menu shadow="md" width={120}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconEdit size={14} />}
                onClick={() => {
                  navigate(`/air/export-job/edit`, {
                    state: { job: row.original },
                  });
                }}
              >
                Edit
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate]
  );

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [data, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const table = useMantineReactTable({
    columns,
    data: paginatedData,
    enableColumnFilters: false,
    enablePagination: false, // Use custom pagination
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    initialState: {
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
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
    },
    mantineTableBodyCellProps: {
      style: {
        padding: "8px 12px",
        fontSize: "13px",
        backgroundColor: "#ffffff",
      },
    },
    mantineTableHeadCellProps: {
      style: {
        padding: "6px 12px",
        fontSize: "12px",
        backgroundColor: "#ffffff",
        top: 0,
        zIndex: 3,
        borderBottom: "1px solid #e9ecef",
      },
    },
    mantineTableContainerProps: {
      style: {
        fontSize: "13px",
        width: "100%",
        minHeight: "300px",
        maxHeight: "59vh",
        overflowY: "auto",
        overflowX: "auto",
        position: "relative",
      },
    },
    renderEmptyRowsFallback: () => (
      <tr>
        <td colSpan={columns.length}>
          <Center py="xl">
            <Stack align="center" gap="md">
              <Text c="dimmed" size="lg" ta="center">
                No jobs to display
              </Text>
            </Stack>
          </Center>
        </td>
      </tr>
    ),
  });

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="center" mb="md" wrap="nowrap">
        <Text size="md" fw={600} c="#105476">
          Air Export Job List
        </Text>

        <Button
          variant="filled"
          leftSection={<IconPlus size={14} />}
          size="xs"
          color="#105476"
          onClick={() => navigate("/air/export-job/create")}
        >
          Create New
        </Button>
      </Group>

      {isLoading ? (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">Loading air export jobs...</Text>
          </Stack>
        </Center>
      ) : (
        <div style={{ position: "relative" }}>
          {isFetching && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                borderRadius: "8px",
              }}
            >
              <Stack align="center" gap="md">
                <Loader size="lg" color="#105476" />
                <Text c="dimmed">Refreshing data...</Text>
              </Stack>
            </div>
          )}
          <MantineReactTable table={table} />
        </div>
      )}

      {/* Custom Pagination Bar */}
      <Group
        w="100%"
        justify="space-between"
        align="center"
        p="xs"
        wrap="nowrap"
        pt="md"
      >
        {/* Rows per page and range */}
        <Group gap="sm" align="center" wrap="nowrap">
          <Text size="sm" c="dimmed">
            Rows per page
          </Text>
          <Select
            size="xs"
            data={["10", "25", "50"]}
            value={String(pageSize)}
            onChange={(val) => {
              if (!val) return;
              handlePageSizeChange(Number(val));
            }}
            w={110}
            styles={
              { input: { fontSize: 12, height: 30 } } as Record<string, unknown>
            }
          />
          <Text size="sm" c="dimmed">
            {(() => {
              const total = totalRecords || 0;
              if (total === 0) return "0–0 of 0";
              const start = (currentPage - 1) * pageSize + 1;
              const end = Math.min(currentPage * pageSize, total);
              return `${start}–${end} of ${total}`;
            })()}
          </Text>
        </Group>

        {/* Page controls */}
        <Group gap="xs" align="center" wrap="nowrap" pr={50}>
          <ActionIcon
            variant="default"
            size="sm"
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text size="sm" ta="center" style={{ width: 26 }}>
            {currentPage}
          </Text>
          <Text size="sm" c="dimmed">
            of {Math.max(1, Math.ceil(totalRecords / pageSize))}
          </Text>
          <ActionIcon
            variant="default"
            size="sm"
            onClick={() => {
              const totalPages = Math.max(
                1,
                Math.ceil(totalRecords / pageSize)
              );
              handlePageChange(Math.min(totalPages, currentPage + 1));
            }}
            disabled={(() => {
              const totalPages = Math.max(
                1,
                Math.ceil(totalRecords / pageSize)
              );
              return currentPage >= totalPages;
            })()}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Card>
  );
}

export default AirExportJobMaster;
