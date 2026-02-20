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
  TextInput,
  Grid,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useDebouncedValue } from "@mantine/hooks";
import { Dropdown, SearchableSelect } from "../../../components";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { useListFilterStore } from "../../../store/listFilterStore";

const LIST_KEY = "GL_CHARGE_MAPPING_MASTER";

type GLChargeMappingMaster = {
  id?: string | number;
  sno?: number;
  charge_id?: number | string;
  charge_name?: string;
  charge_code?: string;
  country_id?: number | string;
  country_name?: string;
  country_code?: string;
  service_id?: number | string;
  service_code?: string;
  service_name?: string;
  revenue_gl_id?: number | string;
  revenue_gl_name?: string;
  revenue_gl_code?: string;
  cost_gl_id?: number | string;
  cost_gl_name?: string;
  cost_gl_code?: string;
  neutral_gl_id?: number | string;
  neutral_gl_name?: string;
  neutral_gl_code?: string;
  revenue_sl_id?: number | string;
  revenue_sl_name?: string;
  revenue_sl_code?: string;
  cost_sl_id?: number | string;
  cost_sl_name?: string;
  cost_sl_code?: string;
  neutral_sl_id?: number | string;
  neutral_sl_name?: string;
  neutral_sl_code?: string;
  status?: "ACTIVE" | "INACTIVE";
};

type GLChargeMappingFilters = {
  charge_id: string;
  charge_name: string;
  country_id: string;
  country_name: string;
  service_id: string;
  service_name: string;
  revenue_gl_id: string;
  revenue_gl_name: string;
  cost_gl_id: string;
  cost_gl_name: string;
  neutral_gl_id: string;
  neutral_gl_name: string;
  revenue_sl_id: string;
  revenue_sl_name: string;
  cost_sl_id: string;
  cost_sl_name: string;
  neutral_sl_id: string;
  neutral_sl_name: string;
  status: string;
};

type CountryData = {
  id: number;
  country_code: string;
  country_name: string;
  status?: string;
};

type ServiceData = {
  id: number;
  service_name: string;
  service_code?: string;
  status?: string;
};

export default function GLChargeMappingMasterList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const DEFAULT_FILTERS: GLChargeMappingFilters = {
    charge_id: "",
    charge_name: "",
    country_id: "",
    country_name: "",
    service_id: "",
    service_name: "",
    revenue_gl_id: "",
    revenue_gl_name: "",
    cost_gl_id: "",
    cost_gl_name: "",
    neutral_gl_id: "",
    neutral_gl_name: "",
    revenue_sl_id: "",
    revenue_sl_name: "",
    cost_sl_id: "",
    cost_sl_name: "",
    neutral_sl_id: "",
    neutral_sl_name: "",
    status: "",
  };

  const [draftFilters, setDraftFilters] =
    useState<GLChargeMappingFilters>(DEFAULT_FILTERS);

  const [appliedFilters, setAppliedFilters] =
    useState<GLChargeMappingFilters>(DEFAULT_FILTERS);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore){
      setIsRestoring(false);
      return
    };

    if (typeof stored?.search === "string") setSearch(stored.search);

    if (stored?.filters && typeof stored.filters === "object") {
      const f = stored.filters as GLChargeMappingFilters;
      const restored = { ...DEFAULT_FILTERS, ...f };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY)
    setShouldRestore(LIST_KEY, false);

    setIsRestoring(false);
  }, [location.key]);

  const currentPage = pagination.pageIndex + 1;
  const statusOptions = ["ACTIVE", "INACTIVE"];

  // Fetch countries data
  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(`${URL.country}`, API_HEADER)) as
          | CountryData[]
          | { success: boolean; data: CountryData[] };

        if (response && typeof response === "object" && "success" in response) {
          return response.data || [];
        }
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching countries:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch service data
  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      try {
        const response = (await getAPICall(
          `${URL.serviceMaster}`,
          API_HEADER,
        )) as ServiceData[] | { success: boolean; data: ServiceData[] };

        if (response && typeof response === "object" && "success" in response) {
          return response.data || [];
        }
        return Array.isArray(response) ? response : [];
      } catch (error) {
        console.error("Error fetching services:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Memoized dropdown options
  const countryOptions = useMemo(() => {
    return (countries as CountryData[])
      .filter((country) => !country.status || country.status === "ACTIVE")
      .map((country) => ({
        value: country.country_code,
        label: country.country_name,
      }));
  }, [countries]);

  const serviceOptions = useMemo(() => {
    return (services as ServiceData[])
      .filter((service) => !service.status || service.status === "ACTIVE")
      .map((service) => ({
        value: String(service.id),
        label: service.service_name,
      }));
  }, [services]);

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

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
  };

  const clearAllFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const buildFiltersPayload = (
    filters: GLChargeMappingFilters,
    searchValue: string,
  ) => {
    const cleaned: Record<string, any> = {};

    // Add filter IDs (convert empty strings to undefined to exclude them)
    if (filters.charge_id && filters.charge_id.trim() !== "")
      cleaned.charge_id = Number(filters.charge_id);

    // Convert country_code to country_id
    if (filters.country_id && filters.country_id.trim() !== "") {
      const country = (countries as CountryData[]).find(
        (c) => c.country_code === filters.country_id,
      );
      if (country) {
        cleaned.country_id = country.id;
      }
    }

    if (filters.service_id && filters.service_id.trim() !== "")
      cleaned.service_id = Number(filters.service_id);
    if (filters.revenue_gl_id && filters.revenue_gl_id.trim() !== "")
      cleaned.revenue_gl_id = Number(filters.revenue_gl_id);
    if (filters.cost_gl_id && filters.cost_gl_id.trim() !== "")
      cleaned.cost_gl_id = Number(filters.cost_gl_id);
    if (filters.neutral_gl_id && filters.neutral_gl_id.trim() !== "")
      cleaned.neutral_gl_id = Number(filters.neutral_gl_id);
    if (filters.revenue_sl_id && filters.revenue_sl_id.trim() !== "")
      cleaned.revenue_sl_id = Number(filters.revenue_sl_id);
    if (filters.cost_sl_id && filters.cost_sl_id.trim() !== "")
      cleaned.cost_sl_id = Number(filters.cost_sl_id);
    if (filters.neutral_sl_id && filters.neutral_sl_id.trim() !== "")
      cleaned.neutral_sl_id = Number(filters.neutral_sl_id);
    if (filters.status && filters.status.trim() !== "")
      cleaned.status = filters.status;

    if (searchValue?.trim()) cleaned.search = searchValue;

    return cleaned;
  };

  // Fetch GL charge mapping data with React Query
  const {
    data: glChargeMappingData = [],
    isLoading: glChargeMappingLoading,
    isFetching: glChargeMappingFetching,
    error: glChargeMappingError,
  } = useQuery({
    queryKey: [
      "gl-charge-mapping",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const index = pagination.pageIndex * pagination.pageSize;

        const filtersPayload = buildFiltersPayload(
          appliedFilters,
          debouncedSearch,
        );

        const payload =
          Object.keys(filtersPayload).length > 0
            ? { filters: filtersPayload }
            : {};
        
        setIsInitialLoad(false);

        const response = await apiCallProtected.post(
          `${URL.glChargeMappingFilter}?&index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        setShowFilters(false);

        const data = response as any;
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching GL charge mapping data:", error);
        setShowFilters(false);
        setTotalRecords(0);
        throw error;
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = glChargeMappingFetching || glChargeMappingLoading || isInitialLoad;
  const tableData = glChargeMappingData ?? [];

  const columns = useMemo<MRT_ColumnDef<GLChargeMappingMaster>[]>(
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
      { accessorKey: "charge_name", header: "Charge Name", size: 180 },
      {
        accessorKey: "country_name",
        header: "Country Name",
        size: 120,
        Cell: ({ cell }) => {
          const value = cell.getValue<string | null | undefined>();
          return value && value.trim() !== "" ? value : "-";
        },
      },
      { accessorKey: "service_name", header: "Service Name", size: 150 },
      { accessorKey: "revenue_gl_name", header: "Revenue GL Name", size: 150 },
      { accessorKey: "cost_gl_name", header: "Cost GL Name", size: 150 },
      { accessorKey: "neutral_gl_name", header: "Neutral GL Name", size: 150 },
      { accessorKey: "revenue_sl_name", header: "Revenue SL Name", size: 150 },
      { accessorKey: "cost_sl_name", header: "Cost SL Name", size: 150 },
      { accessorKey: "neutral_sl_name", header: "Neutral SL Name", size: 150 },
      {
        accessorKey: "status",
        header: "Status",
        size: 90,
        Cell: ({ cell }) => {
          const value = cell.getValue<"ACTIVE" | "INACTIVE">();

          return (
            <Badge
              color={value === "ACTIVE" ? "green" : "red"}
              variant="light"
              size="sm"
              radius="sm"
              px={8}
            >
              {value}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 70,
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
                  onClick={() => {
                    setStoreFilters(LIST_KEY, appliedFilters);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/master/gl-charge-mapping/edit", {
                      state: { ...row.original },
                    });
                  }}
                >
                  <Group gap={"sm"}>
                    <IconEdit size={16} style={{ color: "#105476" }} />
                    <Text size="sm" style={{ fontFamily: "Inter, sans-serif" }}>
                      Edit
                    </Text>
                  </Group>
                </UnstyledButton>
              </Box>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [
      navigate,
      appliedFilters,
      search,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
    ],
  );

  const table = useMantineReactTable({
    columns,
    data: tableData,
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
    },
    mantinePaperProps: {
      shadow: "sm",
      p: "sm",
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
      if (column.id === "actions") {
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
            c={"#444955"}
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            GL Charge Mapping Master List
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
                    onClick={() => {
                      setSearch("");
                    }}
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
                  fontstyle: "regular",
                  color: "#333740",
                  minWidth: "24px",
                  minHeight: "24px",
                  width: "248px",
                  height: "36px",
                  border: "1px solid #D0D1D4",
                  "&:focus": {
                    border: "1px solid #105476",
                  },
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
              onClick={() => {
                setStoreFilters(LIST_KEY, appliedFilters);
                setStoreSearch(LIST_KEY, search);
                setShouldRestore(LIST_KEY, true);
                navigate("/master/gl-charge-mapping/create");
              }}
            >
              Create New
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Filter Section */}
      {showFilters && (
        <Box
          tt="capitalize"
          mb="sm"
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
              padding: "4px 8px",
              borderRadius: "8px 8px 0 0",
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

          <Grid gutter="sm" px="md" pt="xs" pb="sm">
            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.chargeMaster}
                label="Charge Name"
                placeholder="Type Charge Name"
                value={draftFilters.charge_id || null}
                displayValue={draftFilters.charge_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    charge_id: val || "",
                    charge_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.charge_name ?? ""),
                })}
                searchFields={["charge_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.country}
                label="Country Name"
                placeholder="Type Country Name"
                value={draftFilters.country_id}
                displayValue={draftFilters.country_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    country_id: val || "",
                    country_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.country_name ?? ""),
                })}
                searchFields={["country_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.serviceMaster}
                label="Service Name"
                placeholder="Type Service Name"
                value={draftFilters.service_id}
                displayValue={draftFilters.service_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    service_id: val || "",
                    service_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.service_name ?? ""),
                })}
                searchFields={["service_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.chartOfAccounts}
                label="Revenue GL Name"
                placeholder="Type Revenue GL Name"
                value={draftFilters.revenue_gl_id}
                displayValue={draftFilters.revenue_gl_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    revenue_gl_id: val || "",
                    revenue_gl_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.account_name ?? ""),
                })}
                searchFields={["account_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.chartOfAccounts}
                label="Cost GL Name"
                placeholder="Type Cost GL Name"
                value={draftFilters.cost_gl_id}
                displayValue={draftFilters.cost_gl_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    cost_gl_id: val || "",
                    cost_gl_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.account_name ?? ""),
                })}
                searchFields={["account_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.chartOfAccounts}
                label="Neutral GL Name"
                placeholder="Type Neutral GL Name"
                value={draftFilters.neutral_gl_id}
                displayValue={draftFilters.neutral_gl_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    neutral_gl_id: val || "",
                    neutral_gl_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.account_name ?? ""),
                })}
                searchFields={["account_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.chartOfAccounts}
                label="Revenue SL Name"
                placeholder="Type Revenue SL Name"
                value={draftFilters.revenue_sl_id}
                displayValue={draftFilters.revenue_sl_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    revenue_sl_id: val || "",
                    revenue_sl_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.account_name ?? ""),
                })}
                searchFields={["account_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.chartOfAccounts}
                label="Cost SL Name"
                placeholder="Type Cost SL Name"
                value={draftFilters.cost_sl_id}
                displayValue={draftFilters.cost_sl_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    cost_sl_id: val || "",
                    cost_sl_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.account_name ?? ""),
                })}
                searchFields={["account_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.chartOfAccounts}
                label="Neutral SL Name"
                placeholder="Type Neutral SL Name"
                value={draftFilters.neutral_sl_id}
                displayValue={draftFilters.neutral_sl_name || ""}
                onChange={(val, option) =>
                  setDraftFilters(prev => ({
                    ...prev,
                    neutral_sl_id: val || "",
                    neutral_sl_name: option?.label || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={2}
                displayFormat={(item) => ({
                  value: String(item.id ?? ""),
                  label: String(item.account_name ?? ""),
                })}
                searchFields={["account_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select Status"
                searchable
                data={statusOptions}
                value={draftFilters.status || null}
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    status: value || "",
                  }))
                }
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
            <Button
              size="sm"
              variant="default"
              onClick={clearAllFilters}
              leftSection={<IconX size={16} />}
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
              Clear Filters
            </Button>
            <Button
              size="sm"
              onClick={applyFilters}
              loading={isLoading}
              disabled={isLoading}
              leftSection={<IconFilter size={16} />}
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
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">Loading GL Charge Mapping data...</Text>
          </Stack>
        </Center>
      ) : glChargeMappingError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">
              Error loading GL charge mapping data. Please try refreshing the
              page.
            </Text>
          </Stack>
        </Center>
      ) : (
        <>
          <MantineReactTable table={table} />

          {/* Custom Pagination Bar */}
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
