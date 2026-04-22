import { useMemo, useState, useEffect, useCallback } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
  useMantineReactTable,
} from "mantine-react-table";
import {
  Group,
  Button,
  Text,
  Card,
  Center,
  Stack,
  Grid,
  Menu,
  ActionIcon,
  Box,
  UnstyledButton,
  TextInput,
  Loader,
} from "@mantine/core";
import {
  IconFilter,
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "@mantine/form";
import {
  SearchableSelect,
  Dropdown,
  SingleDateInput,
} from "../../../components";
import { URL } from "../../../api/serverUrls";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import useDateFormat from "../../../hooks/useDateFormat";
import { useDebouncedValue } from "@mantine/hooks";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useListFilterStore } from "../../../store/listFilterStore";
import FormTextInput from "../../../components/FormTextInput";

const LIST_KEY = "OCEAN_JOB_GENERATION_MASTER";

// Type definitions based on API response
type OceanJobData = {
  id: number;
  service: string;
  origin_code_read: string;
  origin_name: string;
  destination_code_read: string;
  destination_name: string;
  schedule: string;
  vessel: string;
  voyage: string;
  carrier_code_read: string;
  carrier_name: string;
  cut_off_date: string;
  eta: string;
  etd: string;
  status: string;
  equipment_details: Array<{
    id: number;
    container_type_code_read: string;
    container_type_name: string;
    container_no: string;
    customer_seal_no: string;
    actual_seal_no: string;
  }>;
  shipment_details: Array<unknown>;
};

type FilterState = {
  origin: string | null;
  origin_name: string | null;
  destination: string | null;
  destination_name: string | null;
  service: string | null;
  schedule: string | null;
  vessel: string | null;
  voyage: string | null;
  cut_off_date: Date | null;
  eta: Date | null;
  etd: Date | null;
};

function OceanJobGenerationMaster() {
  const navigate = useNavigate();
  const location = useLocation();

  // Detect service type from URL immediately
  const getServiceTypeFromUrl = useCallback(() => {
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("lcl-job-generation")) {
      return "LCL";
    } else if (pathname.includes("fcl-job-generation")) {
      return "FCL";
    }
    return null;
  }, [location.pathname]);

  const dateFormat = useDateFormat();

  // States
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [appliedFilterPayload, setAppliedFilterPayload] = useState<Record<string, unknown>>({
    service: getServiceTypeFromUrl(),
  });

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  // Filter form - Initialize with service type from URL
  const filterForm = useForm<FilterState>({
    initialValues: {
      origin: null,
      origin_name: null,
      destination: null,
      destination_name: null,
      service: getServiceTypeFromUrl(),
      schedule: null,
      vessel: null,
      voyage: null,
      cut_off_date: null,
      eta: null,
      etd: null,
    },
  });

  // Build filter payload
  const buildFilterPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const urlServiceType = getServiceTypeFromUrl();
    if (urlServiceType) payload.service = urlServiceType;
    if (filterForm.values.origin)
      payload.origin_code = filterForm.values.origin;
    if (filterForm.values.destination)
      payload.destination_code = filterForm.values.destination;
    if (filterForm.values.schedule)
      payload.schedule = filterForm.values.schedule;
    if (filterForm.values.vessel) payload.vessel = filterForm.values.vessel;
    if (filterForm.values.voyage) payload.voyage = filterForm.values.voyage;
    if (filterForm.values.cut_off_date)
      payload.cut_off_date = dayjs(filterForm.values.cut_off_date).format(
        "YYYY-MM-DD"
      );
    if (filterForm.values.eta)
      payload.eta = dayjs(filterForm.values.eta).format("YYYY-MM-DD");
    if (filterForm.values.etd)
      payload.etd = dayjs(filterForm.values.etd).format("YYYY-MM-DD");
    return payload;
  }, [filterForm.values, getServiceTypeFromUrl]);

  // Update service filter when URL changes
  useEffect(() => {
    const serviceType = getServiceTypeFromUrl();
    if (serviceType && filterForm.values.service !== serviceType) {
      filterForm.setFieldValue("service", serviceType);
    }
  }, [filterForm, getServiceTypeFromUrl]);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") setSearch(stored.search);

    if (stored?.filters && typeof stored.filters === "object") {
      const f = stored.filters as Record<string, unknown>;
      const payloadOnly: Record<string, unknown> = { ...f };
      delete payloadOnly.origin_name;
      delete payloadOnly.destination_name;
      filterForm.setValues({
        origin: (f.origin_code as string) || (f.origin_code_read as string) || null,
        origin_name: (f.origin_name as string) || null,
        destination:
          (f.destination_code as string) ||
          (f.destination_code_read as string) ||
          null,
        destination_name: (f.destination_name as string) || null,
        service: (f.service as string) || getServiceTypeFromUrl(),
        schedule: (f.schedule as string) || null,
        vessel: (f.vessel as string) || null,
        voyage: (f.voyage as string) || null,
        cut_off_date: f.cut_off_date ? new Date(f.cut_off_date as string) : null,
        eta: f.eta ? new Date(f.eta as string) : null,
        etd: f.etd ? new Date(f.etd as string) : null,
      });
      setAppliedFilterPayload(payloadOnly);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key, clearAllExcept, filterForm, getServiceTypeFromUrl, getState, setShouldRestore]);

  const currentPage = pagination.pageIndex + 1;
  const index = pagination.pageIndex * pagination.pageSize;

  const handlePageSizeChange = (newPageSize: number) =>
    setPagination({ pageIndex: 0, pageSize: newPageSize });
  const handlePageChange = (newPage: number) =>
    setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));

  const {
    data: bookingData,
    isLoading: bookingLoading,
    isFetching: bookingFetching,
    error: bookingError,
  } = useQuery({
    queryKey: [
      "ocean-job-bookings",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilterPayload),
      debouncedSearch,
    ],
    queryFn: async (): Promise<OceanJobData[]> => {
      try {
        const filtersWithSearch: Record<string, unknown> = { ...appliedFilterPayload };
        if (debouncedSearch?.trim()) filtersWithSearch.search = debouncedSearch.trim();

        const payload =
          Object.keys(filtersWithSearch).length > 0
            ? { filters: filtersWithSearch }
            : { filters: { service: getServiceTypeFromUrl() } };

        setIsInitialLoad(false);

        const response = await apiCallProtected.post(
          `${URL.bookingFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        const data = response as {
          total?: number;
          data?: OceanJobData[] | { data?: OceanJobData[]; total?: number };
        };

        const nestedData =
          data?.data && !Array.isArray(data.data)
            ? (data.data as { data?: OceanJobData[]; total?: number })
            : undefined;
        const list: OceanJobData[] = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(nestedData?.data)
            ? nestedData.data
            : [];

        const total = data?.total ?? nestedData?.total ?? list.length;
        setTotalRecords(Number(total));
        return list;
      } catch (error) {
        console.error("Error fetching ocean job list:", error);
        setTotalRecords(0);
        return [];
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = bookingLoading || bookingFetching || isInitialLoad;

  // Display data
  const displayData = useMemo(() => {
    return (bookingData || []).map((row, i) => ({
      ...row,
      sno: index + i + 1,
    }));
  }, [bookingData, index]);

  const applyFilters = () => {
    const payload = buildFilterPayload;
    setAppliedFilterPayload(payload);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, {
      ...payload,
      origin_name: filterForm.values.origin_name || "",
      destination_name: filterForm.values.destination_name || "",
    });
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    filterForm.reset();
    filterForm.setFieldValue("service", getServiceTypeFromUrl());
    const defaultPayload = { service: getServiceTypeFromUrl() };
    setAppliedFilterPayload(defaultPayload as Record<string, unknown>);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
    setSearch("");
    setShowFilters(false);
  };

  const handleEdit = useCallback((job: OceanJobData) => {
    setStoreFilters(LIST_KEY, {
      ...appliedFilterPayload,
      origin_name: filterForm.values.origin_name || "",
      destination_name: filterForm.values.destination_name || "",
    });
    setStoreSearch(LIST_KEY, search);
    setShouldRestore(LIST_KEY, true);
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("lcl-job-generation")) {
      navigate("/SeaExport/lcl-job-generation/edit", {
        state: { job, mode: "edit" },
      });
    } else {
      navigate("/SeaExport/fcl-job-generation/edit", {
        state: { job, mode: "edit" },
      });
    }
  }, [appliedFilterPayload, filterForm.values.destination_name, filterForm.values.origin_name, location.pathname, navigate, search, setShouldRestore, setStoreFilters, setStoreSearch]);

  const handleView = useCallback((job: OceanJobData) => {
    setStoreFilters(LIST_KEY, {
      ...appliedFilterPayload,
      origin_name: filterForm.values.origin_name || "",
      destination_name: filterForm.values.destination_name || "",
    });
    setStoreSearch(LIST_KEY, search);
    setShouldRestore(LIST_KEY, true);
    const pathname = location.pathname.toLowerCase();
    if (pathname.includes("lcl-job-generation")) {
      navigate("/SeaExport/lcl-job-generation/view", {
        state: { job, mode: "view" },
      });
    } else {
      navigate("/SeaExport/fcl-job-generation/view", {
        state: { job, mode: "view" },
      });
    }
  }, [appliedFilterPayload, filterForm.values.destination_name, filterForm.values.origin_name, location.pathname, navigate, search, setShouldRestore, setStoreFilters, setStoreSearch]);

  const columns = useMemo<MRT_ColumnDef<OceanJobData>[]>(
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
        accessorKey: "vessel",
        header: "Vessel",
        size: 150,
        Cell: ({ cell }) => {
          const vessel = cell.getValue<string>();
          return vessel || "-";
        },
      },
      {
        accessorKey: "voyage",
        header: "Voyage",
        size: 120,
        Cell: ({ cell }) => {
          const voyage = cell.getValue<string>();
          return voyage || "-";
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
        accessorKey: "eta",
        header: "ETA",
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? dayjs(date).format(dateFormat) : "-";
        },
      },
      {
        accessorKey: "etd",
        header: "ETD",
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? dayjs(date).format(dateFormat) : "-";
        },
      },
      {
        accessorKey: "cut_off_date",
        header: "Cutoff Date",
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? dayjs(date).format(dateFormat) : "-";
        },
      },

      {
        accessorKey: "schedule",
        header: "Schedule",
        size: 120,
      },

      {
        id: "actions",
        header: "Action",
        size: 100,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-end" shadow="sm" radius={"md"}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px={10} py={5}>
                <UnstyledButton onClick={() => handleView(row.original)}>
                  <Group gap={"sm"}>
                    <IconEye size={16} style={{ color: "#105476" }} />
                    <Text size="sm">View</Text>
                  </Group>
                </UnstyledButton>
              </Box>
              <Menu.Divider />
              <Box px={10} py={5}>
                <UnstyledButton onClick={() => handleEdit(row.original)}>
                  <Group gap={"sm"}>
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text size="sm">Edit</Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [dateFormat, handleEdit, handleView]
  );

  const table = useMantineReactTable({
    columns,
    data: displayData,
    state: {
      pagination,
      isLoading,
    },
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    manualPagination: true,
    rowCount: totalRecords,
    onPaginationChange: setPagination,
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
      if (column.id === "actions") {
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
          fontFamily: "Inter",
          color: "#334155",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      let extraStyles = {};
      if (column.id === "actions") {
        extraStyles = {
          position: "sticky",
          right: 0,
          minWidth: "80px",
          zIndex: 2,
          backgroundColor: "#F8FAFC",
          boxShadow: "0px -2px 4px 0px #00000040",
        };
      }
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
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
    <Card
      shadow="sm"
      pt="md"
      pb="sm"
      px="md"
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
          c="#1E293B"
          style={{ fontFamily: "Inter", fontSize: "16px" }}
        >
          Ocean Job List
        </Text>

        <Group gap="xs" wrap="nowrap">
          <TextInput
            placeholder="Search..."
            leftSection={<IconSearch size={16} />}
            rightSection={
              search ? (
                <ActionIcon
                  variant="transparent"
                  size="sm"
                  onClick={() => setSearch("")}
                  style={{ cursor: "pointer" }}
                >
                  <IconX size={16} />
                </ActionIcon>
              ) : null
            }
            w={248}
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            styles={{
              input: {
                borderRadius: "4px",
                fontSize: "14px",
                fontFamily: "Inter",
                color: "#334155",
                minWidth: "24px",
                minHeight: "24px",
                width: "248px",
                height: "36px",
                border: "1px solid #D0D1D4",
                "&:focus": { border: "1px solid #105476" },
              },
            }}
          />
          <ActionIcon
            variant={showFilters ? "filled" : "outline"}
            size={36}
            color={showFilters ? "#E0F5FF" : "gray"}
            onClick={() => setShowFilters(!showFilters)}
            styles={{
              root: {
                borderRadius: "4px",
                backgroundColor: showFilters ? "#E0F5FF" : "#FFFFFF",
                border: showFilters ? "1px solid #105476" : "1px solid #737780",
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
          <Button
            variant="filled"
            leftSection={<IconPlus size={14} />}
            size="sm"
            color="#105476"
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
            onClick={() => {
              setStoreFilters(LIST_KEY, {
                ...appliedFilterPayload,
                origin_name: filterForm.values.origin_name || "",
                destination_name: filterForm.values.destination_name || "",
              });
              setStoreSearch(LIST_KEY, search);
              setShouldRestore(LIST_KEY, true);
              const pathname = location.pathname.toLowerCase();
              let serviceType = "FCL"; // Default
              let createPath = "/SeaExport/fcl-job-generation/create";
              if (pathname.includes("lcl-job-generation")) {
                serviceType = "LCL";
                createPath = "/SeaExport/lcl-job-generation/create";
              }
              navigate(createPath, { state: { serviceType } });
            }}
          >
            Create New
          </Button>
        </Group>
      </Group>
      </Box>

      {showFilters && (
        <Box
          tt="capitalize"
          mb="md"
          p="sm"
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
              backgroundColor: "#F8FAFC",
              padding: "4px 8px",
            }}
          >
            <Text
              size="sm"
              fw={600}
              c="#1E293B"
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

          <Grid gutter="sm" px="md" pt="xs" pb="sm">

                {/* Vessel Filter */}
                <Grid.Col span={2.4}>
                  <FormTextInput
                    size="xs"
                    label="Vessel"
                    placeholder="Enter vessel name"
                    {...filterForm.getInputProps("vessel")}
                  />
                </Grid.Col>

                {/* Voyage Filter */}
                <Grid.Col span={2.4}>
                  <FormTextInput
                    size="xs"
                    label="Voyage"
                    placeholder="Enter voyage number"
                    {...filterForm.getInputProps("voyage")}
                  />
                </Grid.Col>

                {/* Origin Filter */}
                <Grid.Col span={2.4}>
                  <SearchableSelect
                    size="xs"
                    label="Origin"
                    placeholder="Type origin code or name"
                    apiEndpoint={URL.portMaster}
                    dropdownZIndex={1000}
                    searchFields={["port_code", "port_name"]}
                    additionalParams={{
                      transport_mode: "SEA"
                    }}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={filterForm.values.origin}
                    displayValue={filterForm.values.origin_name}
                    onChange={(value, selectedData) => {
                      filterForm.setFieldValue("origin", value || null);
                      filterForm.setFieldValue("origin_name", selectedData?.label || null);
                    }}
                    minSearchLength={3}
                  />
                </Grid.Col>

                {/* Destination Filter */}
                <Grid.Col span={2.4}>
                  <SearchableSelect
                    size="xs"
                    label="Destination"
                    placeholder="Type destination code or name"
                    apiEndpoint={URL.portMaster}
                    dropdownZIndex={1000}
                    searchFields={["port_code", "port_name"]}
                    additionalParams={{
                      transport_mode: "SEA"
                    }}
                    displayFormat={(item: Record<string, unknown>) => ({
                      value: String(item.port_code),
                      label: `${item.port_name} (${item.port_code})`,
                    })}
                    value={filterForm.values.destination}
                    displayValue={filterForm.values.destination_name}
                    onChange={(value, selectedData) => {
                      filterForm.setFieldValue("destination", value || null);
                      filterForm.setFieldValue(
                        "destination_name",
                        selectedData?.label || null
                      );
                    }}
                    minSearchLength={3}
                  />
                </Grid.Col>

                {/* Schedule Filter */}
                <Grid.Col span={2.4}>
                  <Dropdown
                    size="xs"
                    label="Schedule"
                    placeholder="Select schedule"
                    searchable
                    clearable
                    data={[
                      { value: "Weekly", label: "Weekly" },
                      { value: "Monthly", label: "Monthly" },
                      { value: "Daily", label: "Daily" },
                      { value: "Quarterly", label: "Quarterly" },
                    ]}
                    {...filterForm.getInputProps("schedule")}
                  />
                </Grid.Col>

                {/* ETA Filter */}
                <Grid.Col span={2.4}>
                  <SingleDateInput
                    key={`eta-${filterForm.values.eta}`}
                    label="ETA"
                    placeholder="YYYY-MM-DD"
                    size="xs"
                    value={filterForm.values.eta}
                    onChange={(date) => filterForm.setFieldValue("eta", date)}
                  />
                </Grid.Col>

                {/* ETD Filter */}
                <Grid.Col span={2.4}>
                  <SingleDateInput
                    key={`etd-${filterForm.values.etd}`}
                    label="ETD"
                    placeholder="YYYY-MM-DD"
                    size="xs"
                    value={filterForm.values.etd}
                    onChange={(date) => filterForm.setFieldValue("etd", date)}
                  />
                </Grid.Col>

                {/* Cut Off Date Filter */}
                <Grid.Col span={2.4}>
                  <SingleDateInput
                    key={`cut-off-${filterForm.values.cut_off_date}`}
                    label="Cut Off Date"
                    placeholder="YYYY-MM-DD"
                    size="xs"
                    value={filterForm.values.cut_off_date}
                    onChange={(date) => filterForm.setFieldValue("cut_off_date", date)}
                  />
                </Grid.Col>
          </Grid>

          <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
            <Button
              size="sm"
              variant="default"
              leftSection={<IconX size={16} />}
              onClick={clearAllFilters}
              styles={{
                root: {
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontWeight: 600,
                  height: "36px",
                  border: "1px solid #D0D1D4",
                  color: "#1E293B",
                },
              }}
            >
              Clear Filters
            </Button>
            <Button
              size="sm"
              leftSection={<IconFilter size={16} />}
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
              Apply Filters
            </Button>
          </Group>
        </Box>
      )}

      {isLoading ? (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">Loading ocean job data...</Text>
          </Stack>
        </Center>
      ) : bookingError ? (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Text c="dimmed">Error loading ocean job data. Please try refreshing the page.</Text>
          </Stack>
        </Center>
      ) : (
        <>
          <MantineReactTable table={table} />
          <PaginationBar
            pageSize={pagination.pageSize}
            currentPage={currentPage}
            totalRecords={totalRecords}
            onPageSizeChange={handlePageSizeChange}
            onPageChange={handlePageChange}
            pageSizeOptions={["10", "25", "50"]}
          />
        </>
      )}
    </Card>
  );
}

export default OceanJobGenerationMaster;
