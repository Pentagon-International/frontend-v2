import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastNotification, SearchableSelect } from "../../../components";
import { URL } from "../../../api/serverUrls";
import {
  MantineReactTable,
  MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Menu,
  ActionIcon,
  Box,
  UnstyledButton,
  Group,
  Button,
  Text,
  Card,
  Center,
  Loader,
  Select,
  Stack,
  Grid,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconFilter,
  IconFilterOff,
} from "@tabler/icons-react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import { useForm } from "@mantine/form";
import { DateInput } from "@mantine/dates";
import { IconChevronLeft as IconChevronLeftDate, IconChevronRight as IconChevronRightDate, IconCalendar } from "@tabler/icons-react";

type CoordinatorReassignationData = {
  id: number;
  coordinator_id: string;
  coordinator_name: string;
  coordinator_user_id: number;
  assigned_coordinator_id: string;
  assigned_coordinator_name: string;
  assigned_coordinator_user_id: number;
  from_date: string;
  to_date: string;
  created_by: string;
  branch_code: string;
  company_code: string;
  company_name: string;
  is_active_status: boolean;
  created_at: string;
  updated_at: string;
};

type CoordinatorReassignationApiResponse = {
  count: number;
  results: CoordinatorReassignationData[];
  total?: number;
  filters_total_count?: number;
  pagination_total?: number;
};

type FilterState = {
  coordinator_name: string | null;
  assigned_coordinator_name: string | null;
  from_date: Date | null;
  to_date: Date | null;
};

function CoordinatorReassignationMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Check user permissions from localStorage
  const hasManagerOrStaffAccess = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return false;
      const user = JSON.parse(userStr);
      return user?.is_manager === true || user?.is_staff === true;
    } catch (error) {
      console.error("Error checking user permissions:", error);
      return false;
    }
  }, []);

  // Redirect unauthorized users to /master
  useEffect(() => {
    if (!hasManagerOrStaffAccess) {
      navigate("/master", { replace: true });
    }
  }, [hasManagerOrStaffAccess, navigate]);

  // Pagination states
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [paginationTotal, setPaginationTotal] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  // Store the applied filter payload separately to prevent query key changes when editing fields
  const [appliedFilterPayload, setAppliedFilterPayload] = useState<Record<string, string>>({});
  // Display values for coordinator searchable selects
  const [coordinatorDisplayValue, setCoordinatorDisplayValue] = useState<string | null>(null);
  const [assignedCoordinatorDisplayValue, setAssignedCoordinatorDisplayValue] = useState<string | null>(null);

  // Filter form
  const filterForm = useForm<FilterState>({
    initialValues: {
      coordinator_name: null,
      assigned_coordinator_name: null,
      from_date: null,
      to_date: null,
    },
  });

  // Format date to YYYY-MM-DD in local timezone (not UTC)
  const formatDateLocal = useCallback((date: Date | null): string => {
    if (!date) return "";
    // Format in local timezone to avoid date shifting
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // Build filter payload function from form values
  // Use display values (coordinator names) for the payload
  const buildFilterPayload = useCallback(() => {
    const payload: Record<string, string> = {};
    // Use display value (coordinator name) for payload
    if (coordinatorDisplayValue) {
      payload.coordinator_name = coordinatorDisplayValue;
    }
    if (assignedCoordinatorDisplayValue) {
      payload.assigned_coordinator_name = assignedCoordinatorDisplayValue;
    }
    if (filterForm.values.from_date) {
      payload.from_date = formatDateLocal(filterForm.values.from_date);
    }
    if (filterForm.values.to_date) {
      payload.to_date = formatDateLocal(filterForm.values.to_date);
    }
    return payload;
  }, [filterForm.values, coordinatorDisplayValue, assignedCoordinatorDisplayValue, formatDateLocal]);

  // Fetch coordinator reassignation data with POST API (empty filters initially)
  const {
    data: coordinatorData = [],
    isLoading: coordinatorLoading,
    refetch: refetchCoordinators,
  } = useQuery({
    queryKey: ["coordinatorReassignation", pageIndex, pageSize],
    queryFn: async () => {
      try {
        const offset = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `filter/coordinator-assigned/?limit=${pageSize}&offset=${offset}`,
          { filters: {} }
        );

        const data = response as unknown as CoordinatorReassignationApiResponse;
        if (data && data.results && Array.isArray(data.results)) {
          const count = data.count || 0;
          setTotalCount(count);
          // Calculate pagination total
          const totalPages = Math.ceil(count / pageSize);
          setPaginationTotal(totalPages);
          // Store metadata in cache
          queryClient.setQueryData(["coordinatorMetadata", pageIndex, pageSize], {
            total: count,
            pagination_total: totalPages,
          });
          return data.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching coordinator reassignation data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to fetch coordinator reassignation data",
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Separate query for filtered data - only runs when filters are applied
  // Use appliedFilterPayload in query key instead of buildFilterPayload() to prevent changes when editing fields
  const {
    data: filteredCoordinatorData = [],
    isLoading: filteredCoordinatorLoading,
    refetch: refetchFilteredCoordinators,
  } = useQuery({
    queryKey: ["filteredCoordinatorReassignation", pageIndex, pageSize, appliedFilterPayload],
    queryFn: async () => {
      try {
        // Use appliedFilterPayload instead of building from form values
        if (Object.keys(appliedFilterPayload).length === 0) return [];

        const offset = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `filter/coordinator-assigned/?limit=${pageSize}&offset=${offset}`,
          {
            filters: appliedFilterPayload,
          }
        );

        const data = response as unknown as CoordinatorReassignationApiResponse;
        if (data && data.results && Array.isArray(data.results)) {
          const count = data.count || 0;
          setTotalCount(count);
          const totalPages = Math.ceil(count / pageSize);
          setPaginationTotal(totalPages);
          // Store metadata in cache
          queryClient.setQueryData(["coordinatorMetadata", pageIndex, pageSize], {
            total: count,
            pagination_total: totalPages,
          });
          return data.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching filtered coordinator reassignation data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to fetch filtered coordinator reassignation data",
        });
        return [];
      }
    },
    enabled: false, // Don't run automatically - only when explicitly refetched
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Effect to get pagination metadata from cache
  useEffect(() => {
    const metadata = queryClient.getQueryData<{
      total: number;
      pagination_total: number;
    }>(["coordinatorMetadata", pageIndex, pageSize]);

    if (metadata) {
      setTotalCount(metadata.total || 0);
      setPaginationTotal(metadata.pagination_total || 0);
    }
  }, [queryClient, pageIndex, pageSize, coordinatorData, filteredCoordinatorData]);

  // Determine which data to display
  // Only change data when filters are explicitly applied or cleared
  const displayData = useMemo(() => {
    if (filtersApplied) {
      // If filters are applied, show filtered data (even if empty, it's the correct filtered result)
      return filteredCoordinatorData;
    }
    // If filters are not applied, always show default data
    return coordinatorData;
  }, [coordinatorData, filteredCoordinatorData, filtersApplied]);

  // Loading state - only show loader when actively fetching
  const isLoading = coordinatorLoading || (filtersApplied && filteredCoordinatorLoading);

  // Handle edit
  const handleEdit = useCallback(
    (row: CoordinatorReassignationData) => {
      navigate(`./edit/${row.id}`, {
        state: row,
      });
    },
    [navigate]
  );

  const columns = useMemo<MRT_ColumnDef<CoordinatorReassignationData>[]>(
    () => [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        maxSize: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => {
          // Calculate S.No based on pagination: (pageIndex * pageSize) + rowIndex + 1
          const sno = pageIndex * pageSize + row.index + 1;
          return <Text size="sm">{sno}</Text>;
        },
      },
      {
        accessorKey: "coordinator_name",
        header: "Actual Co-ordinator",
        size: 200,
      },
      {
        accessorKey: "assigned_coordinator_name",
        header: "Assigned To",
        size: 200,
      },
      {
        accessorKey: "from_date",
        header: "From Date",
        size: 150,
      },
      {
        accessorKey: "to_date",
        header: "To Date",
        size: 150,
      },
      {
        id: "actions",
        header: "Action",
        size: 80,
        Cell: ({ row }) => {
          const [menuOpened, setMenuOpened] = useState(false);
          return (
            <Menu
              withinPortal
              position="bottom-end"
              shadow="sm"
              radius={"md"}
              styles={{ dropdown: { width: "100px" } }}
              opened={menuOpened}
              onChange={setMenuOpened}
            >
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Box
                  px={10}
                  py={5}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f0f0f0")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
                      handleEdit(row.original);
                    }}
                  >
                    <Group gap={"sm"} >
                      <IconEdit size={16} style={{ color: "#105476" }} />
                      <Text size="sm">Edit</Text>
                    </Group>
                  </UnstyledButton>
                </Box>
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [handleEdit, pageIndex, pageSize]
  );

  const table = useMantineReactTable<CoordinatorReassignationData>({
    columns,
    data: displayData,
    enableColumnFilters: false,
    enablePagination: false,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
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
        fontWeight: 600,
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
  });

  // Handle pagination changes
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0); // Reset to first page when changing page size
  };

  const handlePageIndexChange = (newPageIndex: number) => {
    setPageIndex(newPageIndex);
  };

  const applyFilters = async () => {
    try {
      const filterPayload = buildFilterPayload();
      const hasFilterValues = Object.keys(filterPayload).length > 0;

      if (!hasFilterValues) {
        // No filters selected - show all data
        setFiltersApplied(false);
        setAppliedFilterPayload({});
        setPageIndex(0);
        setShowFilters(false);
        
        // Invalidate and refetch default data
        await queryClient.invalidateQueries({ queryKey: ["coordinatorReassignation"] });
        await refetchCoordinators();
        
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      // Has filter values - apply filters
      setPageIndex(0);
      setAppliedFilterPayload(filterPayload); // Store the applied payload
      setFiltersApplied(true);
      setShowFilters(false);

      // Invalidate filtered query and refetch with new filters
      await queryClient.invalidateQueries({
        queryKey: ["filteredCoordinatorReassignation"],
      });
      await refetchFilteredCoordinators();
    } catch (error) {
      console.error("Error applying filters:", error);
      ToastNotification({
        type: "error",
        message: "Failed to apply filters",
      });
    }
  };

  const clearAllFilters = async () => {
    // Reset form first
    filterForm.reset();
    setCoordinatorDisplayValue(null);
    setAssignedCoordinatorDisplayValue(null);
    setPageIndex(0);
    setFiltersApplied(false);
    setAppliedFilterPayload({}); // Clear applied payload
    setShowFilters(false);

    // Invalidate queries and refetch default data
    await queryClient.invalidateQueries({ queryKey: ["coordinatorReassignation"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredCoordinatorReassignation"] });
    await refetchCoordinators();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Refresh data when location state changes (after create/edit)
  useEffect(() => {
    if (location.state?.refreshData) {
      setIsRefreshing(true);
      // Refresh data based on current filter state
      if (filtersApplied && Object.keys(appliedFilterPayload).length > 0) {
        refetchFilteredCoordinators().finally(() => {
          setIsRefreshing(false);
          window.history.replaceState({}, document.title);
        });
      } else {
        refetchCoordinators().finally(() => {
          setIsRefreshing(false);
          window.history.replaceState({}, document.title);
        });
      }
    }
  }, [location.state, refetchCoordinators, refetchFilteredCoordinators, filtersApplied, appliedFilterPayload]);

  const { pathname } = useLocation();
  const isBasePath = pathname === "/master/sales-co-ordinator-reassignation";

  // Don't render if user doesn't have access
  if (!hasManagerOrStaffAccess) {
    return null;
  }

  if (!isBasePath) {
    return <Outlet />;
  }

  return (
    <Box>
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600} c="#105476">
          Sales Co-ordinator Reassignation
        </Text>
        <Group gap="xs">
          <Button
            variant="outline"
            leftSection={<IconFilter size={16} />}
            size="xs"
            color="#105476"
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button
            variant="filled"
            leftSection={<IconPlus size={14} />}
            size="xs"
            color="#105476"
            onClick={() => navigate("./create")}
          >
            Create New
          </Button>
        </Group>
      </Group>

      {/* Filter Section */}
      {showFilters && (
        <Card
          shadow="xs"
          padding="md"
          radius="md"
          withBorder
          mb="md"
          bg="#f8f9fa"
        >
          <Group justify="space-between" align="center">
            <Group align="center" gap="xs">
              <IconFilter size={16} color="#105476" />
              <Text size="sm" fw={500} c="#105476">
                Filters
              </Text>
            </Group>
          </Group>

          <Grid mt="md">
            {/* Coordinator Name Filter */}
            <Grid.Col span={3}>
              <SearchableSelect
                size="xs"
                label="Actual Coordinator Name"
                placeholder="Type coordinator name (min 3 letters)"
                apiEndpoint={URL.userByCoordinator}
                searchFields={["user_name", "user_id"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.user_id || item.id || ""),
                  label: String(item.user_name || ""),
                })}
                value={filterForm.values.coordinator_name}
                displayValue={coordinatorDisplayValue}
                onChange={(value, selectedData) => {
                  if (value === null) {
                    filterForm.setFieldValue("coordinator_name", null);
                    setCoordinatorDisplayValue(null);
                  } else {
                    filterForm.setFieldValue("coordinator_name", value || null);
                    setCoordinatorDisplayValue(selectedData?.label || null);
                  }
                }}
                minSearchLength={3}
              />
            </Grid.Col>

            {/* Assigned Coordinator Name Filter */}
            <Grid.Col span={3}>
              <SearchableSelect
                size="xs"
                label="Assigned To"
                placeholder="Type coordinator name (min 3 letters)"
                apiEndpoint={URL.user}
                searchFields={["user_name", "user_id"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.user_id || item.id || ""),
                  label: String(item.user_name || ""),
                })}
                value={filterForm.values.assigned_coordinator_name}
                displayValue={assignedCoordinatorDisplayValue}
                onChange={(value, selectedData) => {
                  if (value === null) {
                    filterForm.setFieldValue("assigned_coordinator_name", null);
                    setAssignedCoordinatorDisplayValue(null);
                  } else {
                    filterForm.setFieldValue("assigned_coordinator_name", value || null);
                    setAssignedCoordinatorDisplayValue(selectedData?.label || null);
                  }
                }}
                minSearchLength={3}
              />
            </Grid.Col>

            {/* From Date Filter */}
            <Grid.Col span={3}>
              <DateInput
                label="From Date"
                placeholder="Select from date"
                size="xs"
                value={filterForm.values.from_date}
                onChange={(date) => filterForm.setFieldValue("from_date", date)}
                valueFormat="YYYY-MM-DD"
                leftSection={<IconCalendar size={18} />}
                leftSectionPointerEvents="none"
                radius="sm"
                nextIcon={<IconChevronRightDate size={16} />}
                previousIcon={<IconChevronLeftDate size={16} />}
                clearable
                styles={{
                  input: { fontSize: "12px" },
                  label: {
                    fontSize: "12px",
                    fontWeight: 500,
                  },
                  day: {
                    width: "2.25rem",
                    height: "2.25rem",
                    fontSize: "0.9rem",
                  },
                }}
              />
            </Grid.Col>

            {/* To Date Filter */}
            <Grid.Col span={3}>
              <DateInput
                label="To Date"
                placeholder="Select to date"
                size="xs"
                value={filterForm.values.to_date}
                onChange={(date) => filterForm.setFieldValue("to_date", date)}
                valueFormat="YYYY-MM-DD"
                leftSection={<IconCalendar size={18} />}
                leftSectionPointerEvents="none"
                radius="sm"
                nextIcon={<IconChevronRightDate size={16} />}
                previousIcon={<IconChevronLeftDate size={16} />}
                clearable
                styles={{
                  input: { fontSize: "12px" },
                  label: {
                    fontSize: "12px",
                    fontWeight: 500,
                  },
                  day: {
                    width: "2.25rem",
                    height: "2.25rem",
                    fontSize: "0.9rem",
                  },
                }}
              />
            </Grid.Col>
          </Grid>

          <Group justify="end" mt="sm">
            <Button
              size="xs"
              variant="outline"
              color="#105476"
              leftSection={<IconFilterOff size={14} />}
              onClick={clearAllFilters}
            >
              Clear Filters
            </Button>
            <Button
              size="xs"
              variant="filled"
              color="#105476"
              leftSection={
                isLoading ? <Loader size={14} /> : <IconFilter size={14} />
              }
              onClick={applyFilters}
              loading={isLoading}
              disabled={isLoading}
            >
              Apply Filters
            </Button>
          </Group>
        </Card>
      )}

        {isLoading || isRefreshing ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading coordinator reassignation data...</Text>
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
                  value={String(pageSize)}
                  onChange={(val) => {
                    if (!val) return;
                    handlePageSizeChange(Number(val));
                  }}
                  w={110}
                  styles={{ input: { fontSize: 12, height: 30 } }}
                />
                <Text size="sm" c="dimmed">
                  {(() => {
                    if (totalCount === 0) return "0–0 of 0";
                    const start = pageIndex * pageSize + 1;
                    const end = Math.min((pageIndex + 1) * pageSize, totalCount);
                    return `${start}–${end} of ${totalCount}`;
                  })()}
                </Text>
              </Group>

              {/* Page controls */}
              <Group gap="xs" align="center" wrap="nowrap" mt={10}>
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() => handlePageIndexChange(Math.max(0, pageIndex - 1))}
                  disabled={pageIndex === 0}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <Text size="sm" ta="center" style={{ width: 26 }}>
                  {pageIndex + 1}
                </Text>
                <Text size="sm" c="dimmed">
                  of {Math.max(1, paginationTotal)}
                </Text>
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const totalPages = Math.max(1, paginationTotal);
                    handlePageIndexChange(Math.min(totalPages - 1, pageIndex + 1));
                  }}
                  disabled={pageIndex >= paginationTotal - 1}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </>
        )}
      </Card>
    </Box>
  );
}

export default CoordinatorReassignationMaster;

