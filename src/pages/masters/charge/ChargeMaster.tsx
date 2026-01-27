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

type ChargeMaster = {
  id?: string;
  charge_code?: string;
  charge_name?: string;
  description?: string;
  status?: "ACTIVE" | "INACTIVE";
};
type ChargeFilters = {
  charge_code: string;
  charge_name: string;
  charges_type: string;
  calculation_type: string;
  status: string;
};

export default function ChargeMasterList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const DEFAULT_FILTERS: ChargeFilters = {
    charge_code: "",
    charge_name: "",
    charges_type: "",
    calculation_type: "",
    status: "",
  };

  const [draftFilters, setDraftFilters] =
    useState<ChargeFilters>(DEFAULT_FILTERS);

  const [appliedFilters, setAppliedFilters] =
    useState<ChargeFilters>(DEFAULT_FILTERS);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const currentPage = pagination.pageIndex + 1;
  const chargesTypeOptions = ["FREIGHT", "ORIGIN", "DESTINATION"];
  const calculationTypeOptions = ["PER_CONTAINER", "SHIPMENT", "UNIT"];
  const statusOptions = ["ACTIVE", "INACTIVE"];
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

  // const applyFilters = () => {
  //   setAppliedFilters(draftFilters);
  //   setPagination((p) => ({ ...p, pageIndex: 0 }));
  // };

  // const clearAllFilters = () => {
  //   setDraftFilters(DEFAULT_FILTERS);
  //   setAppliedFilters(DEFAULT_FILTERS);
  //   setPagination((p) => ({ ...p, pageIndex: 0 }));
  // };

  const buildFiltersPayload = (filters: ChargeFilters, searchValue: string) => {
    const cleaned = Object.entries(filters).reduce(
      (acc, [key, value]) => {
        if (value && value.trim() !== "") acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    if (searchValue?.trim()) cleaned.search = searchValue;

    return cleaned;
  };

  // Fetch charge data with React Query
  const {
    data: chargeData = [],
    isLoading: chargeLoading,
    isFetching: chargeFetching,
    error: chargeError,
  } = useQuery({
    queryKey: [
      "charges",
      pagination.pageIndex,
      pagination.pageSize,
      appliedFilters,
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const index = pagination.pageIndex * pagination.pageSize;

        // const filtersPayload = buildFiltersPayload(
        //   appliedFilters,
        //   debouncedSearch,
        // );

        const payload =
          // Object.keys(filtersPayload).length > 0
          //   ? { filters: filtersPayload } :
          {};

        const response = await apiCallProtected.post(
          `${URL.chargeMasterFilter}?${debouncedSearch && "search=" + debouncedSearch}&index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        // setShowFilters(false);

        const data = response as any;
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching charge data:", error);
        // setShowFilters(false);
        setTotalRecords(0);
        throw error;
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const isLoading = chargeFetching || chargeLoading;
  const tableData = chargeData ?? [];

  // useEffect(() => {
  //   if (chargeData) {
  //     setTotalRecords(chargeData.total);
  //   }
  // }, [chargeData]);

  const columns = useMemo<MRT_ColumnDef<ChargeMaster>[]>(
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
      { accessorKey: "charge_code", header: "Charge Code", size: 80 },
      { accessorKey: "charge_name", header: "Charge Name", size: 180 },
      { accessorKey: "charges_type", header: "Charges Type", size: 120 },
      {
        accessorKey: "calculation_type",
        header: "Calculation Type",
        size: 150,
      },
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
                  onClick={() =>
                    navigate("/master/charge/edit", { state: row.original })
                  }
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
    [navigate],
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
            Charge Master List
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
            {/* <ActionIcon
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
            </ActionIcon> */}
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
              onClick={() => navigate("/master/charge/create")}
            >
              Create New
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Filter Section */}
      {/* {showFilters && (
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
              <TextInput
                size="xs"
                label="Charge Code"
                placeholder="Type Charge Code"
                value={draftFilters.charge_code}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    charge_code: e.currentTarget.value,
                  }))
                }
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <TextInput
                size="xs"
                label="Charge Name"
                placeholder="Type Charge Name"
                value={draftFilters.charge_name}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    charge_name: e.currentTarget.value,
                  }))
                }
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <Select
                size="xs"
                label="Charges Type"
                placeholder="Select Charge Type"
                data={chargesTypeOptions}
                value={draftFilters.charges_type}
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    charges_type: value || "",
                  }))
                }
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <Select
                size="xs"
                label="Calculation Type"
                placeholder="Select Calculation Type"
                data={calculationTypeOptions}
                value={draftFilters.calculation_type}
                onChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    calculation_type: value || "",
                  }))
                }
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <Select
                size="xs"
                label="Status"
                placeholder="Select Status"
                data={statusOptions}
                value={draftFilters.status}
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
      )} */}

      {isLoading ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">Loading Charges data...</Text>
          </Stack>
        </Center>
      ) : chargeError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#105476" />
            <Text c="dimmed">
              Error loading charge data. Please try refreshing the page.
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
