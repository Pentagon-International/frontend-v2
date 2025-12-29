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
  Group,
  Menu,
  Text,
  TextInput,
  UnstyledButton,
  Grid,
  Loader,
  Select,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEyeSpark,
  IconPlus,
  IconSearch,
  IconFilter,
  IconFilterOff,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { Outlet, useNavigate } from "react-router-dom";
import { ToastNotification, SearchableSelect } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { URL } from "../../../api/serverUrls";
import { deleteApiCall } from "../../../service/deleteApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthStore from "../../../store/authStore";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import { apiCallProtected } from "../../../api/axios";
import { DateInput } from "@mantine/dates";

type Freight = {
  id: number;
  origin_name: string;
  destination_name: string;
  valid_from: string;
  valid_to: string;
  status?: string;
  tariff_charges?: any[];
  service?: string;
};

type FilterState = {
  origin: string | null;
  destination: string | null;
  service: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
};

export default function Freight() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Add local search state
  const [localSearchTerm, setLocalSearchTerm] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filter states - similar to CallEntryMaster
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Store display values (labels) for SearchableSelect fields
  const [originDisplayValue, setOriginDisplayValue] = useState<string | null>(null);
  const [destinationDisplayValue, setDestinationDisplayValue] = useState<string | null>(null);

  // Filter form to minimize state variables
  const filterForm = useForm<FilterState>({
    initialValues: {
      origin: null,
      destination: null,
      service: null,
      valid_from: null,
      valid_to: null,
    },
  });

  // State to store the actual applied filter values
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    origin: null,
    destination: null,
    service: null,
    valid_from: null,
    valid_to: null,
  });

  // Service options - simple list like EnquiryMaster
  const serviceOptions = useMemo(
    () => [
      { value: "FCL", label: "FCL" },
      { value: "LCL", label: "LCL" },
      { value: "AIR", label: "AIR" },
    ],
    []
  );

  // Fetch freight data with React Query - initial fetch without filters
  const {
    data: freightVal = [],
    isLoading: isFreightLoading,
    refetch: refetchFreight,
  } = useQuery({
    queryKey: ["freight"],
    queryFn: async () => {
      try {
        const requestBody: { filters: any } = { filters: {} };

        const response = await apiCallProtected.post(
          URL.filter_freight,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        // Handle response - API returns { results: [...] } or { result: [...] }
        if (data && Array.isArray(data.results)) {
          return data.results;
        } else if (data && Array.isArray(data.result)) {
          return data.result;
        } else if (data && Array.isArray(data.data)) {
          return data.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching freight data:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    enabled: true, // Enable to run automatically on mount with empty filters
  });

  // Separate query for filtered data - only runs when filters are applied
  const {
    data: filteredFreightData = [],
    isLoading: filteredFreightLoading,
    refetch: refetchFilteredFreight,
  } = useQuery({
    queryKey: ["filteredFreight", filtersApplied, appliedFilters],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        const payload: any = {};

        if (appliedFilters.origin)
          payload.origin_code = appliedFilters.origin;
        if (appliedFilters.destination)
          payload.destination_code = appliedFilters.destination;
        if (appliedFilters.service)
          payload.service = appliedFilters.service;
        if (appliedFilters.valid_from)
          payload.valid_from = dayjs(appliedFilters.valid_from).format("YYYY-MM-DD");
        if (appliedFilters.valid_to)
          payload.valid_to = dayjs(appliedFilters.valid_to).format("YYYY-MM-DD");

        if (Object.keys(payload)?.length === 0) return [];

        const requestBody = { filters: payload };
        const response = await apiCallProtected.post(
          URL.filter_freight,
          requestBody
        );
        const data = response as any;
        console.log("Filter API response:", data);

        // Handle both 'result' and 'results' properties
        if (data && Array.isArray(data.result)) {
          return data.result;
        } else if (data && Array.isArray(data.results)) {
          return data.results;
        } else if (data && Array.isArray(data.data)) {
          return data.data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching filtered freight data:", error);
        return [];
      }
    },
    enabled: false, // Don't run automatically - only when Apply Filters is clicked
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Determine which data to display
  const displayData = useMemo(() => {
    // Check if we have filtered data (filters were applied)
    if (filtersApplied) {
      console.log("Displaying filtered data:", filteredFreightData);
      return Array.isArray(filteredFreightData) ? filteredFreightData : [];
    }
    console.log("Displaying unfiltered data:", freightVal);
    return Array.isArray(freightVal) ? freightVal : [];
  }, [freightVal, filteredFreightData, filtersApplied]);

  // Filter data based on local search term (client-side search on displayed data)
  const filteredFreightDataForDisplay = useMemo<Freight[]>(() => {
    if (!localSearchTerm.trim()) {
      return displayData as Freight[];
    }

    const searchLower = localSearchTerm.toLowerCase();

    return (displayData as Freight[]).filter((item) => {
      // Search in tariff charges for carrier and charge details
      const tariffCharges = item.tariff_charges || [];

      // Check if any tariff charge matches the search criteria
      const chargeMatches = tariffCharges.some((charge: any) => {
        const chargeName = charge.charge_name?.toLowerCase() || "";
        return chargeName.includes(searchLower);
      });

      // Search in other fields
      const originName = item.origin_name?.toLowerCase() || "";
      const destinationName = item.destination_name?.toLowerCase() || "";
      const validFrom = item.valid_from?.toLowerCase() || "";
      const validTo = item.valid_to?.toLowerCase() || "";
      const status = item.status?.toLowerCase() || "";
      const service = (item.service || "").toLowerCase();

      // Check if search term matches any of these fields
      return (
        chargeMatches ||
        originName.includes(searchLower) ||
        destinationName.includes(searchLower) ||
        validFrom.includes(searchLower) ||
        validTo.includes(searchLower) ||
        status.includes(searchLower) ||
        service.includes(searchLower)
      );
    });
  }, [displayData, localSearchTerm]);

  // Loading state
  const isLoading = useMemo(() => {
    if (filtersApplied) {
      return filteredFreightLoading;
    }
    return isFreightLoading;
  }, [isFreightLoading, filteredFreightLoading, filtersApplied]);

  const applyFilters = async () => {
    try {
      console.log("Applying filters...");
      console.log("Current filters:", filterForm.values);

      // Check if there are any actual filter values (excluding date range which is handled separately)
      const hasFilterValues =
        filterForm.values.origin ||
        filterForm.values.destination ||
        filterForm.values.service ||
        filterForm.values.valid_from ||
        filterForm.values.valid_to;

      if (!hasFilterValues) {
        // If no filter values, show unfiltered data
        setFiltersApplied(false);
        setAppliedFilters({
          origin: null,
          destination: null,
          service: null,
          valid_from: null,
          valid_to: null,
        });

        // Invalidate and refetch unfiltered data
        await queryClient.invalidateQueries({ queryKey: ["freight"] });
        await refetchFreight();
        ToastNotification({
          type: "info",
          message: "No filters selected, showing all data",
        });
        console.log("No filter values provided, showing unfiltered data");
        return;
      }

      setFiltersApplied(true); // Mark filters as applied

      // Store the current filter form values as applied filters
      setAppliedFilters({
        origin: filterForm.values.origin,
        destination: filterForm.values.destination,
        service: filterForm.values.service,
        valid_from: filterForm.values.valid_from,
        valid_to: filterForm.values.valid_to,
      });

      // Enable the filtered query and refetch
      await queryClient.invalidateQueries({
        queryKey: ["filteredFreight"],
      });
      setShowFilters(false);

      await refetchFilteredFreight();

      console.log("Filters applied successfully");
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const clearAllFilters = async () => {
    setShowFilters(false);
    filterForm.reset(); // Reset form to initial values
    setLocalSearchTerm("");
    setFiltersApplied(false); // Reset filters applied state

    // Reset applied filters state
    setAppliedFilters({
      origin: null,
      destination: null,
      service: null,
      valid_from: null,
      valid_to: null,
    });

    // Clear display values
    setOriginDisplayValue(null);
    setDestinationDisplayValue(null);

    // Invalidate queries and refetch unfiltered data
    await queryClient.invalidateQueries({ queryKey: ["freight"] });
    await queryClient.invalidateQueries({ queryKey: ["filteredFreight"] });
    await queryClient.removeQueries({ queryKey: ["filteredFreight"] }); // Remove filtered data from cache
    await refetchFreight();

    ToastNotification({
      type: "success",
      message: "All filters cleared successfully",
    });
  };

  const handleDelete = async (value: any) => {
    try {
      const res = await deleteApiCall(URL.freight, API_HEADER, value);
      await refetchFreight();
      ToastNotification({
        type: "success",
        message: `Freight is successfully deleted`,
      });
    } catch (err: any) {
      ToastNotification({
        type: "error",
        message: `Error while deleting data: ${err?.message || err}`,
      });
    }
  };

  const columns = useMemo<MRT_ColumnDef<Freight>[]>(
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
        header: "Origin",
        size: 150,
      },
      {
        accessorKey: "destination_name",
        header: "Destination",
        size: 150,
      },
      {
        accessorKey: "service",
        header: "Service",
        size: 100,
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
                    navigate("/tariff/freight/create", {
                      state: {
                        ...row.original,
                        actionType: "view",
                      },
                    })
                  }
                >
                  <Group gap={"sm"}>
                    <IconEyeSpark size={16} style={{ color: "#105476" }} />
                    <Text size="sm">View Freight</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              {user?.is_staff && (
                <>
                  <Menu.Divider />
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() =>
                        navigate("/tariff/freight/create", {
                          state: {
                            ...row.original,
                            actionType: "edit",
                          },
                        })
                      }
                    >
                      <Group gap={"sm"}>
                        <IconEdit size={16} style={{ color: "#105476" }} />
                        <Text size="sm">Edit Freight</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate, user?.is_staff]
  );

  const table = useMantineReactTable({
    columns,
    data: filteredFreightDataForDisplay as Freight[],
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
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
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
    mantineTableBodyCellProps: ({ column }) => {
      let extraStyles = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "30px",
            zIndex: 2,
          };
          break;
        default:
          extraStyles = {};
      }
      return {
        style: {
          width: "fit-content",
          padding: "6px 8px",
          fontSize: "13px",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      let extraStyles = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "30px",
            zIndex: 2,
          };
          break;
        default:
          extraStyles = {};
      }
      return {
        style: {
          width: "fit-content",
          padding: "6px 8px",
          fontSize: "12px",
          backgroundColor: "#ffffff",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid #e9ecef",
          ...extraStyles,
        },
      };
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

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb="md" wrap="nowrap">
          <Group align="center" gap="xs">
            <Text size="md" fw={600}>
              List of Freight
            </Text>
            {(() => {
              // Check if origin/destination are selected via filters
              const hasFilterSelection = filtersApplied && (appliedFilters.origin || appliedFilters.destination);
              
              if (hasFilterSelection) {
                // Show filter selection
                return (
                  <>
                    {appliedFilters.origin && (
                      <>
                        <Text size="md" fw={600}>
                          from:
                        </Text>
                        <Badge variant="light" color="#105476" size="md">
                          {originDisplayValue || appliedFilters.origin}
                        </Badge>
                      </>
                    )}
                    {appliedFilters.origin && appliedFilters.destination && (
                      <Text size="md" fw={600}>
                        to:
                      </Text>
                    )}
                    {appliedFilters.destination && (
                      <Badge variant="light" color="#105476" size="md">
                        {destinationDisplayValue || appliedFilters.destination}
                      </Badge>
                    )}
                  </>
                );
              } else {
                // Show All
                return (
                  <>
                    <Text size="md" fw={600}>
                      :
                    </Text>
                    <Badge variant="light" color="#105476" size="md">
                      All
                    </Badge>
                  </>
                );
              }
            })()}
          </Group>

          <Group gap="sm" wrap="nowrap">
            <TextInput
              placeholder="Search by charge name"
              leftSection={<IconSearch size={16} />}
              style={{ width: 350, height: 32, fontSize: 14 }}
              radius="sm"
              size="xs"
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              disabled={isFreightLoading}
            />

            <Button
              variant="outline"
              leftSection={<IconFilter size={16} />}
              size="xs"
              color="#105476"
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>

            {user?.is_staff && (
              <Button
                color={"#105476"}
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={() => navigate("/tariff/freight/create")}
                disabled={false}
              >
                Create New
              </Button>
            )}
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
                  {/* Origin Filter */}
                  <Grid.Col span={2.4}>
                    <SearchableSelect
                      size="xs"
                      label="Origin"
                      placeholder="Type origin code or name"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: any) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.origin}
                      displayValue={originDisplayValue}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("origin", value || null);
                        setOriginDisplayValue(selectedData?.label || null);
                      }}
                      minSearchLength={3}
                      className="filter-searchable-select"
                    />
                  </Grid.Col>

                  {/* Destination Filter */}
                  <Grid.Col span={2.4}>
                    <SearchableSelect
                      size="xs"
                      label="Destination"
                      placeholder="Type destination code or name"
                      apiEndpoint={URL.portMaster}
                      searchFields={["port_code", "port_name"]}
                      displayFormat={(item: any) => ({
                        value: String(item.port_code),
                        label: `${item.port_name} (${item.port_code})`,
                      })}
                      value={filterForm.values.destination}
                      displayValue={destinationDisplayValue}
                      onChange={(value, selectedData) => {
                        filterForm.setFieldValue("destination", value || null);
                        setDestinationDisplayValue(selectedData?.label || null);
                      }}
                      minSearchLength={3}
                      className="filter-searchable-select"
                    />
                  </Grid.Col>

                  {/* Service Filter */}
                  <Grid.Col span={2.4}>
                    <Select
                      key={`service-${filterForm.values.service}`}
                      label="Service"
                      placeholder="Select Service"
                      searchable
                      clearable
                      size="xs"
                      data={serviceOptions}
                      {...filterForm.getInputProps("service")}
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

                  {/* Valid From Date Filter */}
                  <Grid.Col span={2.4}>
                    <DateInput
                      key={`valid-from-${filterForm.values.valid_from}`}
                      label="Valid From"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      {...filterForm.getInputProps("valid_from")}
                      valueFormat="YYYY-MM-DD"
                      leftSection={<IconCalendar size={14} />}
                      leftSectionPointerEvents="none"
                      radius="md"
                      nextIcon={<IconChevronRight size={16} />}
                      previousIcon={<IconChevronLeft size={16} />}
                      clearable
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      } as any}
                    />
                  </Grid.Col>

                  {/* Valid To Date Filter */}
                  <Grid.Col span={2.4}>
                    <DateInput
                      key={`valid-to-${filterForm.values.valid_to}`}
                      label="Valid To"
                      placeholder="YYYY-MM-DD"
                      size="xs"
                      {...filterForm.getInputProps("valid_to")}
                      valueFormat="YYYY-MM-DD"
                      leftSection={<IconCalendar size={14} />}
                      leftSectionPointerEvents="none"
                      radius="md"
                      nextIcon={<IconChevronRight size={16} />}
                      previousIcon={<IconChevronLeft size={16} />}
                      clearable
                      styles={{
                        input: { fontSize: "12px" },
                        label: {
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#495057",
                        },
                      } as any}
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

        {/* Show table */}
        {(() => {
          if (isLoading) {
            return (
              <Box p="xl" style={{ textAlign: "center", display:"flex", alignItems:"center", justifyContent:"center", gap:"5px" }}>
                <Loader color="#105475" size="sm"/>
                <Text>Loading freight...</Text>
              </Box>
            );
          }
          
          if ((displayData as Freight[]).length === 0) {
            return (
              <Box p="xl" style={{ textAlign: "center" }}>
                <Text c="dimmed">
                  No freight found {filtersApplied && "for this filters"}
                </Text>
              </Box>
            );
          }
          
          return (
            <>
              <MantineReactTable table={table} />

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
                    styles={{ input: { fontSize: 12, height: 30 } } as any}
                  />
                  <Text size="sm" c="dimmed">
                    {(() => {
                      const total = totalRecords || filteredFreightDataForDisplay.length || 0;
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
                    onClick={() =>
                      handlePageChange(Math.max(1, currentPage - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <IconChevronLeft size={16} />
                  </ActionIcon>
                  <Text size="sm" ta="center" style={{ width: 26 }}>
                    {currentPage}
                  </Text>
                  <Text size="sm" c="dimmed">
                    of {Math.max(1, Math.ceil((totalRecords || filteredFreightDataForDisplay.length || 0) / pageSize))}
                  </Text>
                  <ActionIcon
                    variant="default"
                    size="sm"
                    onClick={() => {
                      const totalPages = Math.max(
                        1,
                        Math.ceil((totalRecords || filteredFreightDataForDisplay.length || 0) / pageSize)
                      );
                      handlePageChange(Math.min(totalPages, currentPage + 1));
                    }}
                    disabled={(() => {
                      const totalPages = Math.max(
                        1,
                        Math.ceil((totalRecords || filteredFreightDataForDisplay.length || 0) / pageSize)
                      );
                      return currentPage >= totalPages;
                    })()}
                  >
                    <IconChevronRight size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </>
          );
        })()}

        <Outlet />
      </Card>
    </>
  );
}
