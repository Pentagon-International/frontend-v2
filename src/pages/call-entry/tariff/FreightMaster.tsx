import { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Text,
  UnstyledButton,
  Grid,
  Loader,
  Select,
  Center,
  Stack,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconFilter,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconEye,
} from "@tabler/icons-react";
import { Outlet, useNavigate } from "react-router-dom";
import { ToastNotification, SearchableSelect } from "../../../components";
import { URL } from "../../../api/serverUrls";
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
  const [originDisplayValue, setOriginDisplayValue] = useState<string | null>(
    null
  );
  const [destinationDisplayValue, setDestinationDisplayValue] = useState<
    string | null
  >(null);

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

  // Fetch freight data with React Query - initial fetch without filters with pagination
  const {
    data: freightVal = [],
    isLoading: isFreightLoading,
    refetch: refetchFreight,
  } = useQuery({
    queryKey: ["freight", currentPage, pageSize],
    queryFn: async () => {
      try {
        const requestBody: { filters: any } = { filters: {} };

        const response = await apiCallProtected.post(
          `${URL.filter_freight}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Initial load API response:", data);

        // Handle response - API returns { data: [...], total: ... } or { results: [...], total: ... }
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        } else if (data && Array.isArray(data.results)) {
          setTotalRecords(data.total || data.results.length);
          return data.results;
        } else if (data && Array.isArray(data.result)) {
          setTotalRecords(data.total || data.result.length);
          return data.result;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching freight data:", error);
        setTotalRecords(0);
        return [];
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    enabled: true, // Enable to run automatically on mount
  });

  // Separate query for filtered data - only runs when filters are applied with pagination
  const {
    data: filteredFreightData = [],
    isLoading: filteredFreightLoading,
    refetch: refetchFilteredFreight,
  } = useQuery({
    queryKey: [
      "filteredFreight",
      filtersApplied,
      appliedFilters,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      try {
        if (!filtersApplied) return [];

        const payload: any = {};

        if (appliedFilters.origin) payload.origin_code = appliedFilters.origin;
        if (appliedFilters.destination)
          payload.destination_code = appliedFilters.destination;
        if (appliedFilters.service) payload.service = appliedFilters.service;
        if (appliedFilters.valid_from)
          payload.valid_from = dayjs(appliedFilters.valid_from).format(
            "YYYY-MM-DD"
          );
        if (appliedFilters.valid_to)
          payload.valid_to = dayjs(appliedFilters.valid_to).format(
            "YYYY-MM-DD"
          );

        if (Object.keys(payload)?.length === 0) return [];

        const requestBody = { filters: payload };
        const response = await apiCallProtected.post(
          `${URL.filter_freight}?index=${(currentPage - 1) * pageSize}&limit=${pageSize}`,
          requestBody
        );
        const data = response as any;
        console.log("Filter API response:", data);

        // Handle response with total count
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        } else if (data && Array.isArray(data.result)) {
          setTotalRecords(data.total || data.result.length);
          return data.result;
        } else if (data && Array.isArray(data.results)) {
          setTotalRecords(data.total || data.results.length);
          return data.results;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching filtered freight data:", error);
        setTotalRecords(0);
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

        // Reset to first page
        setCurrentPage(1);

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

      // Reset to first page when applying filters
      setCurrentPage(1);

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

    // Reset to first page
    setCurrentPage(1);

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
        header: "Actions",
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
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text size="sm">View</Text>
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
                        <Text size="sm">Edit</Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        ),
        size: 80,
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
      pagination: { pageSize: pageSize, pageIndex: currentPage - 1 },
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
      let extraStyles: Record<string, any> = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "30px",
            zIndex: 2,
            borderLeft: "1px solid #F3F3F3",
            boxShadow: "1px -2px 4px 0px #00000040",
          };
          break;
        default:
          extraStyles = {};
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
      let extraStyles: Record<string, any> = {};
      switch (column.id) {
        case "actions":
          extraStyles = {
            position: "sticky",
            right: 0,
            minWidth: "80px",
            zIndex: 2,
            backgroundColor: "#FBFBFB",
            boxShadow: "0px -2px 4px 0px #00000040",
          };
          break;
        default:
          extraStyles = {};
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

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Refetch data when pagination changes
  useEffect(() => {
    if (filtersApplied) {
      refetchFilteredFreight();
    } else {
      refetchFreight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  return (
    <>
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
        <Box>
          <Group justify="space-between" align="center" pb="sm">
            <Text
              size="md"
              fw={600}
              c={"#444955"}
              style={{ fontFamily: "Inter", fontSize: "16px" }}
            >
              List of Freight
            </Text>

            <Group gap="xs" wrap="nowrap">
              <ActionIcon
                variant={showFilters ? "filled" : "outline"}
                size={36}
                color={showFilters ? "#E0F5FF" : "gray"}
                onClick={() => setShowFilters(!showFilters)}
                styles={{
                  root: {
                    borderRadius: "4px",
                    backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                    border: showFilters
                      ? "1px solid #105476"
                      : "1px solid #737780",
                    color: showFilters ? "#105476" : "#737780",
                    "&:active": {
                      border: "1px solid #105476",
                      color: "#FFFFFF",
                    },
                  },
                }}
              >
                <IconFilter size={18} />
              </ActionIcon>

              {user?.is_staff && (
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
                      fontStyle: "semibold",
                      "&:hover": {
                        backgroundColor: "#105476",
                      },
                    },
                  }}
                  onClick={() => navigate("/tariff/freight/create")}
                >
                  Create New
                </Button>
              )}
            </Group>
          </Group>
        </Box>

        {/* Filter Section */}
        {showFilters && (
          <Box
            tt="capitalize"
            mb="xs"
            style={{
              borderRadius: "8px",
              border: "1px solid #E0E0E0",
              flexShrink: 0,
              height: "fit-content",
            }}
          >
            <Group
              justify="space-between"
              align="center"
              mb="sm"
              px="md"
              style={{
                backgroundColor: "#FAFAFA",
                padding: "8px 8px",
                borderRadius: "8px",
              }}
            >
              <Text
                size="sm"
                fw={600}
                c="#000000"
                style={{ fontFamily: "Inter", fontSize: "14px" }}
              >
                Filter
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setShowFilters(false)}
                aria-label="Close filters"
                size="sm"
              >
                <IconX size={18} />
              </ActionIcon>
            </Group>

            <Grid gutter="md" px="md">
              {/* Origin Filter */}
              <Grid.Col span={2.4}>
                <SearchableSelect
                  size="xs"
                  label="Origin"
                  placeholder="Type Origin Code"
                  apiEndpoint={URL.portMaster}
                  searchFields={["port_name", "port_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
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
                  placeholder="Type Destination Code"
                  apiEndpoint={URL.portMaster}
                  searchFields={["port_name", "port_code"]}
                  displayFormat={(item: Record<string, unknown>) => ({
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
                  value={filterForm.values.service}
                  onChange={(value) =>
                    filterForm.setFieldValue("service", value || null)
                  }
                  onFocus={(event) => {
                    const input = event.target as HTMLInputElement;
                    if (input && input.value) {
                      input.select();
                    }
                  }}
                  styles={{
                    input: { fontSize: "13px", height: "36px" },
                    label: {
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#000000",
                      marginBottom: "4px",
                      fontFamily: "Inter",
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
                  styles={
                    {
                      input: { fontSize: "13px", height: "36px" },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#000000",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                      },
                    } as any
                  }
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
                  styles={
                    {
                      input: { fontSize: "13px", height: "36px" },
                      label: {
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#000000",
                        marginBottom: "4px",
                        fontFamily: "Inter",
                      },
                    } as any
                  }
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
              <Button
                size="sm"
                variant="default"
                onClick={clearAllFilters}
                styles={{
                  root: {
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 600,
                    height: "36px",
                    border: "1px solid #D0D1D4",
                    color: "#444955",
                  },
                }}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={applyFilters}
                loading={isLoading}
                disabled={isLoading}
                styles={{
                  root: {
                    backgroundColor: "#105476",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontFamily: "Inter",
                    fontWeight: 600,
                    height: "36px",
                    "&:hover": {
                      backgroundColor: "#0d4261",
                    },
                  },
                }}
              >
                Apply
              </Button>
            </Group>
          </Box>
        )}

        {isLoading ? (
          <Center py="xl" style={{ flex: 1 }}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text c="dimmed">Loading freight data...</Text>
            </Stack>
          </Center>
        ) : (
          <>
            <MantineReactTable
              key={`table-${filtersApplied ? "filtered" : "unfiltered"}-${filteredFreightDataForDisplay.length}`}
              table={table}
            />

            {/* Custom Pagination Bar */}
            <Group
              w="100%"
              justify="space-between"
              align="center"
              pt="sm"
              pl="sm"
              pr="xl"
              style={{ borderTop: "1px solid #e9ecef", flexShrink: 0 }}
              wrap="nowrap"
              mt="sm"
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
                  styles={{ input: { fontSize: 12, height: 30 } }}
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
              <Group gap="xs" align="center" wrap="nowrap">
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
                  disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </>
        )}

        <Outlet />
      </Card>
    </>
  );
}
