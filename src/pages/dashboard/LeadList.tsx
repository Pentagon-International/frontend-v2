import { useEffect, useMemo, useRef, useState } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Text,
  TextInput,
  Grid,
  Box,
  Center,
  Stack,
  Badge,
  Tooltip,
  Modal,
  ScrollArea,
  Menu,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconFilterOff,
  IconSearch,
  IconFilter,
  IconPlus,
  IconEdit,
  IconDotsVertical,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPICall } from "../../service/getApiCall";
import { URL } from "../../api/serverUrls";
import { API_HEADER } from "../../store/storeKeys";
import { ToastNotification } from "../../components";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { apiCallProtected } from "../../api/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { useLayoutStore } from "../../store/useLayoutStore";

type LeadData = {
  id: number;
  name: string;
  contact_number: string | null;
  contact_person: string | null;
  email_id: string | null;
  location: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
  created_by: string;
  assigned_to: string;
  status: string;
  remark: {
    messages?: Array<{
      sender: string;
      message: string;
      sender_id: number;
      timestamp: string;
    }>;
    interest_level?: string;
  };
  created_at: string;
  updated_at: string;
};

type FilterState = {
  assigned_to: string | null;
  status: string | null;
};

type UserMasterData = {
  id: number;
  user_id: string;
  user_name: string;
  employee_id: string;
  pulse_id: string | null;
  email_id: string;
  status: string;
};

const statusOptions = [
  { label: "All", value: "" },
  { label: "New", value: "New" },
  { label: "Contacted", value: "Contacted" },
  { label: "Qualified", value: "Qualified" },
  { label: "Converted", value: "Converted" },
  { label: "Lost", value: "Lost" },
];

function LeadList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveNav, setActiveSubNav, setTitle } = useLayoutStore();

  // Ensure navigation state is set correctly on mount and refresh
  useEffect(() => {
    setActiveNav("Sales");
    setActiveSubNav("Lead");
    setTitle("Sales");
  }, [setActiveNav, setActiveSubNav, setTitle]);

  // Refs to persist returnToDashboard flag and dashboard state
  const returnToDashboardRef = useRef<boolean>(
    Boolean(location.state?.returnToDashboard)
  ); // Persist returnToDashboard flag
  const dashboardStateRef = useRef<any>(location.state?.dashboardState); // Persist dashboard state
  const fromDashboardRef = useRef<boolean>(
    Boolean(location.state?.fromDashboard)
  ); // Track if page was opened from dashboard

  // Search Debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced] = useDebouncedValue(searchQuery, 500);
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Track if we're restoring filters to trigger refetch after state updates
  const [isRestoringFilters, setIsRestoringFilters] = useState(false);

  // Modal state for remark conversation
  const [
    remarkModalOpened,
    { open: openRemarkModal, close: closeRemarkModal },
  ] = useDisclosure(false);
  const [selectedLeadForRemark, setSelectedLeadForRemark] =
    useState<LeadData | null>(null);

  // Filter form
  const filterForm = useForm<FilterState>({
    initialValues: {
      assigned_to: null,
      status: null,
    },
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    assigned_to: null,
    status: null,
  });

  // Fetch users for assigned_to filter
  const { data: usersData = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(URL.user, API_HEADER)) as UserMasterData[];
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching users data:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const userOptions = useMemo(() => {
    if (!usersData || !Array.isArray(usersData)) return [];
    const options = usersData
      .filter((item) => item?.user_name)
      .map((item) => ({
        value: item.user_name,
        label: item.user_name,
      }));
    // Add "All" option at the beginning
    return [{ label: "All", value: "" }, ...options];
  }, [usersData]);

  // Sync refs with location.state when it changes
  useEffect(() => {
    if (location.state?.returnToDashboard !== undefined) {
      returnToDashboardRef.current = Boolean(location.state.returnToDashboard);
    }
    if (location.state?.dashboardState !== undefined) {
      dashboardStateRef.current = location.state.dashboardState;
    }
    if (location.state?.fromDashboard !== undefined) {
      fromDashboardRef.current = Boolean(location.state.fromDashboard);
    }
  }, [location.state?.returnToDashboard, location.state?.dashboardState, location.state?.fromDashboard]);

  // Fetch lead data with React Query
  const {
    data: leadData = [],
    isLoading: leadLoading,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ["leads", appliedFilters],
    queryFn: async () => {
      try {
        const requestBody: { assigned_to: string; status: string } = {
          assigned_to: appliedFilters.assigned_to || "",
          status: appliedFilters.status || "",
        };

        const response = await apiCallProtected.post(
          URL.leadFilter,
          requestBody
        );
        const data = response as any;

        // Handle response - API returns { data: [...] }
        if (data && Array.isArray(data.data)) {
          return data.data;
        } else if (data && Array.isArray(data.results)) {
          return data.results;
        }
        return [];
      } catch (error) {
        console.error("Error fetching lead data:", error);
        ToastNotification({
          type: "error",
          message: "Error fetching leads. Please try again.",
        });
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: !!location.state?.refreshData, // Refetch on mount if we have refresh flag
  });

  // Determine which data to display
  const displayData = useMemo(() => {
    let filtered = leadData;

    // Apply search filter if search query exists
    if (debounced.trim() !== "") {
      const searchLower = debounced.toLowerCase();
      filtered = filtered.filter((lead: LeadData) => {
        return (
          lead.name?.toLowerCase().includes(searchLower) ||
          lead.contact_person?.toLowerCase().includes(searchLower) ||
          lead.contact_number?.toLowerCase().includes(searchLower) ||
          lead.email_id?.toLowerCase().includes(searchLower) ||
          lead.assigned_to?.toLowerCase().includes(searchLower) ||
          lead.created_by?.toLowerCase().includes(searchLower) ||
          lead.location?.city?.toLowerCase().includes(searchLower) ||
          lead.location?.country?.toLowerCase().includes(searchLower)
        );
      });
    }

    return filtered;
  }, [leadData, debounced]);

  // Loading state
  const isLoading = leadLoading || usersLoading;

  const applyFilters = async () => {
    try {
      // Check if there are any actual filter values
      const hasFilterValues =
        filterForm.values.assigned_to || filterForm.values.status;

      if (!hasFilterValues) {
        // If no filter values, show all data
        setFiltersApplied(false);
        setAppliedFilters({
          assigned_to: null,
          status: null,
        });

        await queryClient.invalidateQueries({ queryKey: ["leads"] });
        await refetchLeads();
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        return;
      }

      setFiltersApplied(true);

      // Store the current filter form values as applied filters
      setAppliedFilters({
        assigned_to: filterForm.values.assigned_to,
        status: filterForm.values.status,
      });

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      setShowFilters(false);

      await refetchLeads();

      ToastNotification({
        type: "success",
        message: "Filters applied successfully",
      });
    } catch (error) {
      console.error("Error applying filters:", error);
      ToastNotification({
        type: "error",
        message: "Error applying filters. Please try again.",
      });
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset();
    setSearchQuery("");
    setFiltersApplied(false);

    // Reset applied filters state
    setAppliedFilters({
      assigned_to: null,
      status: null,
    });

    // Invalidate queries and refetch
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
    await refetchLeads();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  // Handle refresh when navigating from create/edit operations
  useEffect(() => {
    if (location.state?.refreshData) {
      // Refetch all lead related data
      refetchLeads();

      // Clear the refresh state but preserve dashboard return state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });
    }
  }, [
    location.state?.refreshData,
    refetchLeads,
    navigate,
    location.pathname,
  ]);

  // Add effect to restore filters when returning from create/edit operations
  useEffect(() => {
    // Check if we're returning from a create/edit operation with filter restoration
    if (location.state?.restoreFilters) {
      const restoreFiltersData = location.state.restoreFilters;

      // Restore filter form state
      filterForm.setValues({
        assigned_to: restoreFiltersData.filters?.assigned_to || null,
        status: restoreFiltersData.filters?.status || null,
      });

      // Restore applied filters state
      setAppliedFilters({
        assigned_to: restoreFiltersData.filters?.assigned_to || null,
        status: restoreFiltersData.filters?.status || null,
      });

      // Restore filters applied state
      const shouldApplyFilters = restoreFiltersData.filtersApplied || false;
      setFiltersApplied(shouldApplyFilters);

      // Restore fromDashboard flag if present
      if (restoreFiltersData.fromDashboard !== undefined) {
        fromDashboardRef.current = Boolean(restoreFiltersData.fromDashboard);
      }

      // Set flag to trigger refetch after state updates
      setIsRestoringFilters(true);

      // Clear the restore filters flag but preserve dashboard return state
      navigate(location.pathname, {
        replace: true,
        state: {
          returnToDashboard: returnToDashboardRef.current,
          dashboardState: dashboardStateRef.current,
          fromDashboard: fromDashboardRef.current,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.restoreFilters, navigate, location.pathname]);

  // Effect to refetch data after filters are restored and state is updated
  useEffect(() => {
    if (isRestoringFilters) {
      const refreshData = async () => {
        if (filtersApplied) {
          // If filters were applied, invalidate and refetch filtered data
          await queryClient.invalidateQueries({
            queryKey: ["leads"],
          });
          await refetchLeads();
        } else {
          // Otherwise, refetch unfiltered data
          await refetchLeads();
        }
        setIsRestoringFilters(false);
      };

      refreshData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoringFilters, filtersApplied]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "blue";
      case "Contacted":
        return "cyan";
      case "Qualified":
        return "green";
      case "Converted":
        return "teal";
      case "Lost":
        return "red";
      default:
        return "gray";
    }
  };

  const getInterestLevelColor = (level: string | undefined) => {
    switch (level) {
      case "High":
        return "red";
      case "Medium":
        return "yellow";
      case "Low":
        return "gray";
      default:
        return "gray";
    }
  };

  const formatLocation = (location: LeadData["location"]) => {
    if (!location) return "-";
    const parts = [];
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.country) parts.push(location.country);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const getLatestMessage = (remark: LeadData["remark"]) => {
    if (!remark?.messages || remark.messages.length === 0) return "-";
    const latest = remark.messages[remark.messages.length - 1];
    return latest.message || "-";
  };

  const columns = useMemo<MRT_ColumnDef<LeadData>[]>(
    () => [
      {
        id: "sno",
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        maxSize: 70,
        enableColumnFilter: false,
        enableSorting: false,
        enableColumnOrdering: false,
        Cell: ({ row, table }) => {
          // Calculate S.No based on pagination: (pageIndex * pageSize) + rowIndex + 1
          const { pageIndex, pageSize } = table.getState().pagination;
          const sno = pageIndex * pageSize + row.index + 1;
          return <Text size="sm">{sno}</Text>;
        },
      },
      {
        accessorKey: "name",
        header: "Company Name",
        size: 180,
        Cell: ({ row }) => (
          <Text fw={600} size="sm">
            {row.original.name || "-"}
          </Text>
        ),
      },
      {
        accessorKey: "contact_person",
        header: "Contact Person",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm">{row.original.contact_person || "-"}</Text>
        ),
      },
      {
        accessorKey: "contact_number",
        header: "Contact Number",
        size: 130,
        Cell: ({ row }) => (
          <Text size="sm">{row.original.contact_number || "-"}</Text>
        ),
      },
      {
        accessorKey: "email_id",
        header: "Email",
        size: 180,
        Cell: ({ row }) => (
          <Text size="sm">{row.original.email_id || "-"}</Text>
        ),
      },
      {
        accessorKey: "location",
        header: "Location",
        size: 180,
        Cell: ({ row }) => (
          <Text size="sm">{formatLocation(row.original.location)}</Text>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ row }) => (
          <Badge size="sm" color={getStatusColor(row.original.status)}>
            {row.original.status || "-"}
          </Badge>
        ),
      },
      {
        accessorKey: "assigned_to",
        header: "Assigned To",
        size: 130,
        Cell: ({ row }) => (
          <Text fw={500} size="sm">
            {row.original.assigned_to || "-"}
          </Text>
        ),
      },
      {
        accessorKey: "created_by",
        header: "Created By",
        size: 120,
        Cell: ({ row }) => (
          <Text size="sm">{row.original.created_by || "-"}</Text>
        ),
      },
      {
        accessorKey: "interest_level",
        header: "Interest Level",
        size: 120,
        Cell: ({ row }) => (
          <Badge
            size="sm"
            color={getInterestLevelColor(row.original.remark?.interest_level)}
          >
            {row.original.remark?.interest_level || "-"}
          </Badge>
        ),
      },
      {
        accessorKey: "latest_remark",
        header: "Latest Remark",
        size: 150,
        minSize: 150,
        maxSize: 150,
        enableResizing: false,
        Cell: ({ row }) => {
          const message = getLatestMessage(row.original.remark);
          const hasMessages =
            row.original.remark?.messages &&
            row.original.remark.messages.length > 0;

          const handleClick = () => {
            if (hasMessages) {
              setSelectedLeadForRemark(row.original);
              openRemarkModal();
            }
          };

          return (
            <Tooltip
              label={hasMessages ? "Click to view full conversation" : message}
              maw={400}
              fw={500}
              position="top-start"
              bg="#fff"
              style={{
                whiteSpace: "normal",
                padding: "5px 15px",
                color: "#3f3f3fff",
                border: "1px solid #105476",
                boxShadow: "0 2px 10px rgba(0,0,0, 0.2)",
                wordBreak: "break-word",
              }}
              multiline
            >
              <Text
                size="xs"
                style={{
                  cursor: hasMessages ? "pointer" : "default",
                  color: hasMessages ? "#105476" : "inherit",
                  textDecoration: hasMessages ? "underline" : "none",
                }}
                truncate
                onClick={handleClick}
              >
                {message}
              </Text>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Created At",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm">
            {row.original.created_at
              ? dayjs(row.original.created_at).format("DD-MM-YYYY HH:mm")
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Updated At",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm">
            {row.original.updated_at
              ? dayjs(row.original.updated_at).format("DD-MM-YYYY HH:mm")
              : "-"}
          </Text>
        ),
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
                  navigate("/lead-create", {
                    state: {
                      leadData: row.original,
                      returnTo: "/lead",
                      restoreFilters: {
                        filters: appliedFilters,
                        filtersApplied,
                        fromDashboard: fromDashboardRef.current,
                      },
                    },
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
    [navigate, appliedFilters, filtersApplied]
  );

  const table = useMantineReactTable({
    columns,
    data: displayData,
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
      columnPinning: { left: ["sno"] },
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
  });

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Group gap="xs">
            <Text size="md" fw={600} c={"#105476"}>
              Lead List
            </Text>
            {filtersApplied && (
              <Badge size="sm" color="#105476">
                Filters Active
              </Badge>
            )}
            <Text size="sm" c="dimmed">
              ({displayData.length} {displayData.length === 1 ? "lead" : "leads"})
            </Text>
          </Group>

          <Group gap="sm" wrap="nowrap">
            {/* <TextInput
              placeholder="Search"
              leftSection={<IconSearch size={16} />}
              style={{ width: 300 }}
              radius="sm"
              size="xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            /> */}

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
              leftSection={<IconPlus size={16} />}
              size="xs"
              color="#105476"
              onClick={() =>
                navigate("/lead-create", {
                  state: {
                    returnTo: "/lead",
                    restoreFilters: {
                      filters: appliedFilters,
                      filtersApplied,
                      fromDashboard: fromDashboardRef.current,
                    },
                  },
                })
              }
            >
              Create Lead
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

            <Grid>
              <Grid.Col span={12}>
                <Grid>
                  {/* Status Filter */}
                  <Grid.Col span={6}>
                    <Select
                      label="Status"
                      placeholder="Select Status"
                      searchable
                      clearable
                      size="xs"
                      data={statusOptions}
                      nothingFoundMessage="No status found"
                      disabled={isLoading}
                      value={filterForm.values.status || ""}
                      onChange={(value) =>
                        filterForm.setFieldValue("status", value || null)
                      }
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      }}
                    />
                  </Grid.Col>

                  {/* Assigned To Filter */}
                  <Grid.Col span={6}>
                    <Select
                      label="Assigned To"
                      placeholder={
                        usersLoading
                          ? "Loading users..."
                          : "Select User"
                      }
                      searchable
                      clearable
                      size="xs"
                      data={userOptions}
                      nothingFoundMessage={
                        usersLoading
                          ? "Loading users..."
                          : "No users found"
                      }
                      disabled={usersLoading}
                      value={filterForm.values.assigned_to || ""}
                      onChange={(value) =>
                        filterForm.setFieldValue("assigned_to", value || null)
                      }
                      onFocus={(event) => {
                        const input = event.target as HTMLInputElement;
                        if (input && input.value) {
                          input.select();
                        }
                      }}
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      }}
                    />
                  </Grid.Col>
                </Grid>
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
                leftSection={isLoading ? <Loader size={14} /> : <IconFilter size={14} />}
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
              >
                Apply Filters
              </Button>
            </Group>
          </Card>
        )}

        {isLoading ? (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading leads...</Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable
              key={`table-${filtersApplied ? "filtered" : "unfiltered"}-${displayData.length}`}
              table={table}
            />

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
              {/* Left side: Rows per page */}
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
                  styles={{ input: { fontSize: 12, height: 30 } } as any}
                />
                <Text size="sm" c="dimmed">
                  {(() => {
                    const { pageIndex, pageSize } = table.getState().pagination;
                    const total =
                      table.getPrePaginationRowModel().rows.length || 0;
                    if (total === 0) return "0–0 of 0";
                    const start = pageIndex * pageSize + 1;
                    const end = Math.min((pageIndex + 1) * pageSize, total);
                    return `${start}–${end} of ${total}`;
                  })()}
                </Text>
              </Group>

              {/* Right side: Page controls */}
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
                      (table.getPrePaginationRowModel().rows.length || 0) /
                        table.getState().pagination.pageSize
                    )
                  )}
                </Text>
                <ActionIcon
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const total =
                      table.getPrePaginationRowModel().rows.length || 0;
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
                    const total =
                      table.getPrePaginationRowModel().rows.length || 0;
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

      {/* Conversation Modal */}
      <Modal
        opened={remarkModalOpened}
        onClose={closeRemarkModal}
        title={
          <Stack gap={4}>
            <Text size="lg" fw={600} c="#105476">
              Conversation
            </Text>
            {selectedLeadForRemark && (
              <Group gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  {selectedLeadForRemark.name}
                </Text>
                {selectedLeadForRemark.remark?.interest_level && (
                  <>
                    <Text size="sm" c="dimmed">
                      •
                    </Text>
                    <Badge
                      size="sm"
                      color={getInterestLevelColor(
                        selectedLeadForRemark.remark.interest_level
                      )}
                    >
                      {selectedLeadForRemark.remark.interest_level} Interest
                    </Badge>
                  </>
                )}
              </Group>
            )}
          </Stack>
        }
        size="lg"
        centered
        styles={{
          title: {
            paddingBottom: "12px",
          },
          body: {
            padding: "0",
          },
        }}
      >
        {selectedLeadForRemark?.remark?.messages &&
        selectedLeadForRemark.remark.messages.length > 0 ? (
          <Box>
            {/* Conversation Messages */}
            <ScrollArea style={{ maxHeight: 550 }}>
              <Stack gap="xs" p="md" style={{ backgroundColor: "#f8f9fa" }}>
                {(() => {
                  // Get unique senders to determine alignment
                  const messages = selectedLeadForRemark.remark?.messages || [];
                  const uniqueSenders = Array.from(
                    new Set(messages.map((m) => m.sender))
                  );
                  const firstSender = uniqueSenders[0];
                  const isFirstSender = (sender: string) =>
                    sender === firstSender;

                  return messages.map((msg, index) => {
                      const prevMessage =
                        index > 0 ? messages[index - 1] : null;
                      const showSenderHeader =
                        !prevMessage || prevMessage.sender !== msg.sender;
                      const showDateSeparator =
                        !prevMessage ||
                        dayjs(msg.timestamp).format("DD-MM-YYYY") !==
                          dayjs(prevMessage.timestamp).format("DD-MM-YYYY");
                      const isLeftAligned = isFirstSender(msg.sender);

                      return (
                        <Box key={index}>
                          {/* Date Separator */}
                          {showDateSeparator && (
                            <Center my="md">
                              <Badge
                                size="sm"
                                variant="light"
                                color="gray"
                                style={{ textTransform: "none" }}
                              >
                                {dayjs(msg.timestamp).format("DD MMMM YYYY")}
                              </Badge>
                            </Center>
                          )}

                          {/* Message Bubble */}
                          <Group
                            align="flex-start"
                            gap="xs"
                            style={{
                              flexDirection: isLeftAligned
                                ? "row"
                                : "row-reverse",
                            }}
                          >
                            <Box
                              style={{
                                maxWidth: "75%",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: isLeftAligned
                                  ? "flex-start"
                                  : "flex-end",
                              }}
                            >
                              {/* Sender Name */}
                              {showSenderHeader && (
                                <Text
                                  size="xs"
                                  fw={600}
                                  c="#105476"
                                  mb={4}
                                  style={{
                                    paddingLeft: isLeftAligned ? "8px" : "0",
                                    paddingRight: isLeftAligned ? "0" : "8px",
                                  }}
                                >
                                  {msg.sender}
                                </Text>
                              )}

                              {/* Message Bubble */}
                              <Box
                                style={{
                                  backgroundColor: isLeftAligned
                                    ? "#ffffff"
                                    : "#105476",
                                  color: isLeftAligned ? "#333" : "#ffffff",
                                  padding: "10px 14px",
                                  borderRadius: isLeftAligned
                                    ? "12px 12px 12px 4px"
                                    : "12px 12px 4px 12px",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                  border: isLeftAligned
                                    ? "1px solid #e9ecef"
                                    : "none",
                                }}
                              >
                                <Text
                                  size="sm"
                                  style={{
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    lineHeight: 1.5,
                                    color: isLeftAligned ? "#333" : "#ffffff",
                                  }}
                                >
                                  {msg.message}
                                </Text>
                              </Box>

                              {/* Timestamp */}
                              <Text
                                size="xs"
                                c="dimmed"
                                mt={4}
                                style={{
                                  paddingLeft: isLeftAligned ? "8px" : "0",
                                  paddingRight: isLeftAligned ? "0" : "8px",
                                }}
                              >
                                {dayjs(msg.timestamp).format("HH:mm")}
                              </Text>
                            </Box>
                          </Group>
                        </Box>
                      );
                    }
                  );
                  })()}
                </Stack>
            </ScrollArea>

            {/* Footer */}
            <Box
              p="md"
              style={{
                borderTop: "1px solid #e9ecef",
                backgroundColor: "#ffffff",
              }}
            >
              <Group justify="flex-end">
                <Button
                  variant="outline"
                  onClick={closeRemarkModal}
                  color="#105476"
                  size="sm"
                >
                  Close
                </Button>
              </Group>
            </Box>
          </Box>
        ) : (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed" size="sm">
                No conversation available
              </Text>
              <Button
                variant="outline"
                onClick={closeRemarkModal}
                color="#105476"
                size="sm"
              >
                Close
              </Button>
            </Stack>
          </Center>
        )}
      </Modal>
    </>
  );
}

export default LeadList;
