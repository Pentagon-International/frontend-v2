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
  TextInput,
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

type CustomerRelationshipMappingData = {
  sno: number;
  id: number;
  customer_id?: number;
  customer_code: string;
  customer_name: string;
  emp_id_display: string;
  emp_name: string;
  relationship_type: string;
  service_code: string;
  service_name: string;
  branch_code: string | null;
  branch_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type CustomerRelationshipMappingApiResponse = {
  total: number;
  all_data: boolean;
  index: number;
  limit: number;
  results: CustomerRelationshipMappingData[];
};

type FilterState = {
  customer_code: string | null;
  emp_name: string | null;
  branch_name: string | null;
  service_name: string | null;
  relationship_type: string | null;
};

function CustomerRelationshipMappingMaster() {
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
  // Display values for filter searchable selects
  const [customerDisplayValue, setCustomerDisplayValue] = useState<string | null>(null);
  const [salespersonDisplayValue, setSalespersonDisplayValue] = useState<string | null>(null);
  const [branchDisplayValue, setBranchDisplayValue] = useState<string | null>(null);
  const [serviceDisplayValue, setServiceDisplayValue] = useState<string | null>(null);

  // Filter form
  const filterForm = useForm<FilterState>({
    initialValues: {
      customer_code: null,
      emp_name: null,
      branch_name: null,
      service_name: null,
      relationship_type: null,
    },
  });

  // Build filter payload function from form values
  const buildFilterPayload = useCallback(() => {
    const payload: Record<string, string> = {};
    if (filterForm.values.customer_code) {
      payload.customer_code = filterForm.values.customer_code;
    }
    if (filterForm.values.emp_name) {
      payload.emp_name = filterForm.values.emp_name;
    }
    if (filterForm.values.branch_name) {
      payload.branch_name = filterForm.values.branch_name;
    }
    if (filterForm.values.service_name) {
      payload.service_name = filterForm.values.service_name;
    }
    if (filterForm.values.relationship_type) {
      payload.relationship_type = filterForm.values.relationship_type;
    }
    return payload;
  }, [filterForm.values]);

  // Fetch customer relationship mapping data with POST API (empty filters initially)
  const {
    data: relationshipData = [],
    isLoading: relationshipLoading,
    refetch: refetchRelationships,
  } = useQuery({
    queryKey: ["customerRelationshipMapping", pageIndex, pageSize],
    queryFn: async () => {
      try {
        const offset = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `filter/${URL.customerRelationshipMapping}?limit=${pageSize}&offset=${offset}`,
          { filters: {} }
        );

        const data = response as unknown as CustomerRelationshipMappingApiResponse;
        if (data && data.results && Array.isArray(data.results)) {
          const count = data.total || 0;
          setTotalCount(count);
          // Calculate pagination total
          const totalPages = Math.ceil(count / pageSize);
          setPaginationTotal(totalPages);
          // Store metadata in cache
          queryClient.setQueryData(["relationshipMetadata", pageIndex, pageSize], {
            total: count,
            pagination_total: totalPages,
          });
          return data.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching customer relationship mapping data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to fetch customer relationship mapping data",
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredRelationshipData = [],
    isLoading: filteredRelationshipLoading,
    refetch: refetchFilteredRelationships,
  } = useQuery({
    queryKey: ["filteredCustomerRelationshipMapping", pageIndex, pageSize, appliedFilterPayload],
    queryFn: async () => {
      try {
        // Use appliedFilterPayload instead of building from form values
        if (Object.keys(appliedFilterPayload).length === 0) return [];

        const offset = pageIndex * pageSize;
        const response = await apiCallProtected.post(
          `filter/${URL.customerRelationshipMapping}?limit=${pageSize}&offset=${offset}`,
          {
            filters: appliedFilterPayload,
          }
        );

        const data = response as unknown as CustomerRelationshipMappingApiResponse;
        if (data && data.results && Array.isArray(data.results)) {
          const count = data.total || 0;
          setTotalCount(count);
          const totalPages = Math.ceil(count / pageSize);
          setPaginationTotal(totalPages);
          // Store metadata in cache
          queryClient.setQueryData(["relationshipMetadata", pageIndex, pageSize], {
            total: count,
            pagination_total: totalPages,
          });
          return data.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching filtered customer relationship mapping data:", error);
        ToastNotification({
          type: "error",
          message: "Failed to fetch filtered customer relationship mapping data",
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
    }>(["relationshipMetadata", pageIndex, pageSize]);

    if (metadata) {
      setTotalCount(metadata.total || 0);
      setPaginationTotal(metadata.pagination_total || 0);
    }
  }, [queryClient, pageIndex, pageSize, relationshipData, filteredRelationshipData]);

  // Determine which data to display
  const displayData = useMemo(() => {
    if (filtersApplied) {
      return filteredRelationshipData;
    }
    return relationshipData;
  }, [relationshipData, filteredRelationshipData, filtersApplied]);

  // Loading state - only show loader when actively fetching
  const isLoading = relationshipLoading || (filtersApplied && filteredRelationshipLoading) || isRefreshing;

  // Handle edit
  const handleEdit = useCallback(
    (row: CustomerRelationshipMappingData) => {
      // Navigate to edit page with customer_id in location state (not in URL)
      const customerId = row.customer_id;
      if (customerId) {
        navigate(`./edit`, {
          state: { customer_id: customerId },
        });
      } else {
        // Fallback: if customer_id is not in response, show error
        ToastNotification({
          type: "error",
          message: "Customer ID not available. Please contact support.",
        });
      }
    },
    [navigate]
  );

  const columns = useMemo<MRT_ColumnDef<CustomerRelationshipMappingData>[]>(
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
          // Use sno from API response, fallback to calculated if not present
          return <Text size="sm">{row.original.sno || (pageIndex * pageSize + row.index + 1)}</Text>;
        },
      },
      {
        accessorKey: "customer_name",
        header: "Customer Name",
        size: 180,
      },
      {
        accessorKey: "emp_name",
        header: "Salesperson Name",
        size: 150,
      },
      {
        accessorKey: "relationship_type",
        header: "Relationship Type",
        size: 150,
      },
      {
        accessorKey: "service_name",
        header: "Service Name",
        size: 150,
      },
      {
        accessorKey: "branch_name",
        header: "Branch Name",
        size: 150,
        Cell: ({ row }) => {
          return <Text size="sm">{row.original.branch_name || "-"}</Text>;
        },
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
                    justifyContent: "flex-start",
                  }}
                >
                  <UnstyledButton
                    onClick={() => {
                      setMenuOpened(false);
                      handleEdit(row.original);
                    }}
                  >
                    <Group gap={"sm"}>
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

  const table = useMantineReactTable<CustomerRelationshipMappingData>({
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
        await queryClient.invalidateQueries({ queryKey: ["customerRelationshipMapping"] });
        await refetchRelationships();
        
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
        queryKey: ["filteredCustomerRelationshipMapping"],
      });
      await refetchFilteredRelationships();
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
    setCustomerDisplayValue(null);
    setSalespersonDisplayValue(null);
    setBranchDisplayValue(null);
    setServiceDisplayValue(null);
    setPageIndex(0);
    setFiltersApplied(false);
    setAppliedFilterPayload({}); // Clear applied payload
    setShowFilters(false);

    // Invalidate queries and refetch default data
    await queryClient.invalidateQueries({ queryKey: ["customerRelationshipMapping"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredCustomerRelationshipMapping"] });
    await refetchRelationships();

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
        refetchFilteredRelationships().finally(() => {
          setIsRefreshing(false);
          window.history.replaceState({}, document.title);
        });
      } else {
        refetchRelationships().finally(() => {
          setIsRefreshing(false);
          window.history.replaceState({}, document.title);
        });
      }
    }
  }, [location.state, refetchRelationships, refetchFilteredRelationships, filtersApplied, appliedFilterPayload]);

  const { pathname } = useLocation();
  const isBasePath = pathname === "/master/customer-relationship-mapping";

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
            Customer Relationship Mapping
          </Text>
          <Group gap="xs">
            <Button
              variant={showFilters ? "filled" : "outline"}
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
              {/* Customer Code Filter */}
              <Grid.Col span={3}>
                <SearchableSelect
                  size="xs"
                  label="Customer Name"
                  placeholder="Type customer name"
                  apiEndpoint={URL.customer}
                  searchFields={["customer_name", "customer_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.customer_code || ""),
                    label: String(item.customer_name || ""),
                  })}
                  value={filterForm.values.customer_code}
                  displayValue={customerDisplayValue}
                  onChange={(value, selectedData) => {
                    if (value === null) {
                      filterForm.setFieldValue("customer_code", null);
                      setCustomerDisplayValue(null);
                    } else {
                      filterForm.setFieldValue("customer_code", value || null);
                      setCustomerDisplayValue(selectedData?.label || null);
                    }
                  }}
                  minSearchLength={2}
                />
              </Grid.Col>

              {/* Salesperson Name Filter */}
              <Grid.Col span={3}>
                <SearchableSelect
                  size="xs"
                  label="Salesperson Name"
                  placeholder="Type salesperson name"
                  apiEndpoint={URL.user}
                  searchFields={["user_name", "employee_id", "user_id"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.user_name || ""),
                    label: String(item.user_name || ""),
                  })}
                  value={filterForm.values.emp_name}
                  displayValue={salespersonDisplayValue}
                  onChange={(value, selectedData) => {
                    if (value === null) {
                      filterForm.setFieldValue("emp_name", null);
                      setSalespersonDisplayValue(null);
                    } else {
                      filterForm.setFieldValue("emp_name", value || null);
                      setSalespersonDisplayValue(selectedData?.label || null);
                    }
                  }}
                  minSearchLength={2}
                />
              </Grid.Col>

              {/* Branch Name Filter */}
              <Grid.Col span={3}>
                <SearchableSelect
                  size="xs"
                  label="Branch Name"
                  placeholder="Type branch name"
                  apiEndpoint={URL.branchMaster}
                  searchFields={["branch_name", "branch_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.branch_name || ""),
                    label: String(item.branch_name || ""),
                  })}
                  value={filterForm.values.branch_name}
                  displayValue={branchDisplayValue}
                  onChange={(value, selectedData) => {
                    if (value === null) {
                      filterForm.setFieldValue("branch_name", null);
                      setBranchDisplayValue(null);
                    } else {
                      filterForm.setFieldValue("branch_name", value || null);
                      setBranchDisplayValue(selectedData?.label || null);
                    }
                  }}
                  minSearchLength={2}
                />
              </Grid.Col>

              {/* Service Name Filter */}
              <Grid.Col span={3}>
                <SearchableSelect
                  size="xs"
                  label="Service Name"
                  placeholder="Type service name"
                  apiEndpoint={URL.serviceMaster}
                  searchFields={["service_name", "service_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
                    value: String(item.service_name || ""),
                    label: String(item.service_name || ""),
                  })}
                  value={filterForm.values.service_name}
                  displayValue={serviceDisplayValue}
                  onChange={(value, selectedData) => {
                    if (value === null) {
                      filterForm.setFieldValue("service_name", null);
                      setServiceDisplayValue(null);
                    } else {
                      filterForm.setFieldValue("service_name", value || null);
                      setServiceDisplayValue(selectedData?.label || null);
                    }
                  }}
                  minSearchLength={2}
                />
              </Grid.Col>

              {/* Relationship Type Filter */}
              <Grid.Col span={3}>
                <TextInput
                  size="xs"
                  label="Relationship Type"
                  placeholder="Enter relationship type"
                  value={filterForm.values.relationship_type || ""}
                  onChange={(e) =>
                    filterForm.setFieldValue("relationship_type", e.target.value || null)
                  }
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
              <Text c="dimmed">Loading customer relationship mapping data...</Text>
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

export default CustomerRelationshipMappingMaster;

