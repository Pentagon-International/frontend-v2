import { useEffect, useMemo, useState } from "react";
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
  Card,
  Center,
  Grid,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  Button,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilter,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { useListFilterStore } from "../../../store/listFilterStore";
import dayjs from "dayjs";
import FormTextInput from "../../../components/FormTextInput";
import { Dropdown, SingleDateInput } from "../../../components";
import useDateFormat from "../../../hooks/useDateFormat";

type SupplierInvoiceReversalRow = Record<string, unknown> & {
  id?: number | string;
  sno?: number;
  reverse_crj_number?: string;
  Inv_Crn_no?: string;
  reverse_invoice_no?: string;
  agent_name?: string;
  date?: string;
  Inv_crn_amount?: number | string;
  status?: string;
  [key: string]: unknown;
};

const LIST_KEY = "SUPPLIER_INVOICE_REVERSAL_MASTER";

type SupplierInvoiceReversalFilters = {
  invoice_no: string;
  agent_name: string;
  date_from: Date | null;
  date_to: Date | null;
  status: string;
};

function SupplierInvoiceReversalMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultDateFrom = dayjs().startOf("month").toDate();
  const defaultDateTo = dayjs().toDate();
  const dateFormat = useDateFormat();

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const DEFAULT_FILTERS: SupplierInvoiceReversalFilters = {
    invoice_no: "",
    agent_name: "",
    date_from: defaultDateFrom,
    date_to: defaultDateTo,
    status: "",
  };

  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);

  const [isRestoring, setIsRestoring] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);

  useEffect(() => {
    if (isRestoring) return;
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 },
    );
  }, [debouncedSearch, isRestoring]);

  useEffect(() => {
    const stored = getState(LIST_KEY);
    const shouldRestore = stored?.shouldRestore === true;

    if (!shouldRestore) {
      setIsRestoring(false);
      return;
    }

    if (typeof stored?.search === "string") {
      setSearch(stored.search);
    }

    if (stored?.filters && typeof stored.filters === "object") {
      const raw = stored.filters as Record<string, unknown>;
      const restored = {
        ...DEFAULT_FILTERS,
        ...raw,
        date_from: raw.date_from
          ? new Date(String(raw.date_from))
          : raw.date
            ? new Date(String(raw.date))
            : DEFAULT_FILTERS.date_from,
        date_to: raw.date_to
          ? new Date(String(raw.date_to))
          : raw.date
            ? new Date(String(raw.date))
            : DEFAULT_FILTERS.date_to,
      };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));

    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const currentPage = pagination.pageIndex + 1;
  const index = pagination.pageIndex * pagination.pageSize;

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: page - 1 }));
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
    filters: SupplierInvoiceReversalFilters,
    searchValue: string,
  ) => {
    const cleaned: Record<string, string> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;

      if (key === "date_from") {
        cleaned.date_from = dayjs(value as Date).format("YYYY-MM-DD");
      } else if (key === "date_to") {
        cleaned.date_to = dayjs(value as Date).format("YYYY-MM-DD");
      } else if (key === "invoice_no" && typeof value === "string" && value.trim() !== "") {
        cleaned.crj_number = value;
      } else if (value.trim() !== "") {
        cleaned[key] = value;
      }
    });

    if (searchValue?.trim()) cleaned.search = searchValue;

    return cleaned;
  };

  const {
    data: reversalData = [],
    isLoading: reversalLoading,
    isFetching: reversalFetching,
    error: reversalError,
  } = useQuery({
    queryKey: [
      "supplier-invoice-reversal",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<SupplierInvoiceReversalRow[]> => {
      try {
        const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);

        const payload =
          Object.keys(filtersPayload).length > 0
            ? { filters: filtersPayload }
            : { filters: {} };

        setIsInitialLoad(false);

        const response = await apiCallProtected.post(
          `${URL.reverseSupplierInvoiceFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );

        const raw = response as any;
        const bodyCandidate =
          raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body = bodyCandidate ?? null;

        if (!body) {
          setTotalRecords(0);
          return [];
        }

        const list = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body)
            ? body
            : [];

        const total = body?.total ?? body?.total_count ?? list.length;
        setTotalRecords(Number(total));

        return list;
      } catch (err: unknown) {
        const status = (err as any)?.response?.status;
        if (status === 404) {
          setTotalRecords(0);
          return [];
        }
        throw err;
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const isLoading = reversalFetching || reversalLoading || isInitialLoad;
  const tableData = reversalData ?? [];

  const columns = useMemo<MRT_ColumnDef<SupplierInvoiceReversalRow>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 70,
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => row.original?.sno ?? index + row.index + 1,
      },
      {
        id: "reverse_invoice_no",
        header: "Invoice No",
        size: 160,
        accessorFn: (row) => (row.reverse_crj_number ?? "") as string,
      },
      {
        accessorKey: "agent_name",
        header: "Agent / Supplier",
        size: 200,
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 140,
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.date
              ? dayjs(row.original?.date).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "Inv_crn_amount",
        header: "Amount",
        size: 120,
        Cell: ({ cell }) => {
          const val = cell.getValue<unknown>();
          if (val == null) return "-";
          return typeof val === "number" ? val.toFixed(2) : String(val);
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ cell }) => {
          const val = cell.getValue<unknown>();
          if (val == null) return "-";
          const str = typeof val === "number" ? val.toFixed(2) : String(val);
          const statusUpper = str.toUpperCase();
          const color =
            statusUpper === "POSTED"
              ? "green"
              : statusUpper === "UNPOSTED"
                ? "gray"
                : "#2563EB";
          return (
            <Badge
              size="sm"
              variant="light"
              color={color}
              styles={{ root: { textTransform: "none" } }}
            >
              {str}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        Cell: ({ row }) => {
          const status = String(row.original?.status ?? "").toUpperCase();
          const isUnposted = status === "UNPOSTED";
          return (
            <Menu withinPortal position="bottom-end" shadow="sm" radius="md">
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
                      navigate("/supplier-invoice/reversal/view", {
                        state: row.original,
                      });
                    }}
                  >
                    <Group gap="sm">
                      <IconEye size={16} style={{ color: "#2563EB" }} />
                      <Text
                        size="sm"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        View
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                {isUnposted && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate("/supplier-invoice/reversal/edit", {
                          state: row.original,
                        });
                      }}
                    >
                      <Group gap="sm">
                        <IconEdit size={16} style={{ color: "#2563EB" }} />
                        <Text
                          size="sm"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Edit
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Box>
                )}
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [
      index,
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
      pagination: { pageSize: 10, pageIndex: 0 },
      columnPinning: { right: ["actions"] },
    },
    layoutMode: "grid",
    manualPagination: true,
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
      const extraStyles =
        column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "30px",
              zIndex: 2,
              borderLeft: "1px solid #F3F3F3",
              boxShadow: "1px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          color: "#333740",
          backgroundColor: "#ffffff",
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      const extraStyles =
        column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "80px",
              zIndex: 2,
              backgroundColor: "#FBFBFB",
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          color: "#444955",
          backgroundColor: "#FBFBFB",
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
            c="#444955"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Supplier Invoice Reversal List
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
                    border: "1px solid #2563EB",
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
                    ? "1px solid #2563EB"
                    : "1px solid #737780",
                  color: showFilters ? "#2563EB" : "#737780",
                  "&:active": {
                    border: "1px solid #2563EB",
                    color: "#FFFFFF",
                  },
                },
              }}
            >
              <IconFilter size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {showFilters && (
        <Box
          tt="capitalize"
          mb="sm"
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
              backgroundColor: "#FAFAFA",
              padding: "4px 8px",
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
            <Grid.Col span={3}>
              <FormTextInput
                label="Invoice No"
                placeholder="Type Invoice No"
                value={draftFilters.invoice_no}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    invoice_no: e.currentTarget.value,
                  }))
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <FormTextInput
                label="Agent"
                placeholder="Type Agent"
                value={draftFilters.agent_name}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    agent_name: e.currentTarget.value,
                  }))
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="Date From"
                placeholder="Select Date"
                value={draftFilters.date_from}
                onChange={(date) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    date_from: date,
                  }))
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="Date To"
                placeholder="Select Date"
                value={draftFilters.date_to}
                onChange={(date) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    date_to: date,
                  }))
                }
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select Status"
                data={["POSTED", "UNPOSTED"]}
                value={draftFilters.status}
                searchable
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
                  backgroundColor: "#2563EB",
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
            <Loader size="lg" color="#2563EB" />
            <Text c="dimmed">
              Loading supplier invoice reversal data...
            </Text>
          </Stack>
        </Center>
      ) : reversalError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Text c="dimmed">
              Error loading supplier invoice reversal data. Please try
              refreshing the page.
            </Text>
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

export default SupplierInvoiceReversalMaster;
