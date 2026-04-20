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
  Button,
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
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconFilter,
  IconPlus,
  IconReceiptRefund,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { URL } from "../../../api/serverUrls";
import { useQuery } from "@tanstack/react-query";
import { apiCallProtected } from "../../../api/axios";
import { useDebouncedValue } from "@mantine/hooks";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import { Dropdown, SearchableSelect, SingleDateInput } from "../../../components";
import { useListFilterStore } from "../../../store/listFilterStore";
import dayjs from "dayjs";
import useDateFormat from "../../../hooks/useDateFormat";

const LIST_KEY = "OVERSEAS_RECEIPT_MASTER";

type ReceiptRow = Record<string, unknown> & {
  id?: number | string;
  sno?: number;
  day_book_name?: string;
  receipt_no?: string;
  type?: string;
  status?: string;
  amount?: number | string;
  [key: string]: unknown;
};

type ReceiptFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  data?: ReceiptRow[];
};

type OverseasReceiptFilters = {
  day_book_id: string;
  day_book_name: string;
  receipt_no: string;
  date_from: Date | null;
  date_to: Date | null;
  type: string;
  amount: string;
  status: string;
};

export default function OverseasReceiptMaster() {
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
  const DEFAULT_FILTERS: OverseasReceiptFilters = {
    day_book_id: "",
    day_book_name: "",
    receipt_no: "",
    date_from: defaultDateFrom,
    date_to: defaultDateTo,
    type: "",
    amount: "",
    status: "",
  };
  const [draftFilters, setDraftFilters] =
    useState<OverseasReceiptFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<OverseasReceiptFilters>(DEFAULT_FILTERS);
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
    if (typeof stored?.search === "string") setSearch(stored.search);
    if (stored?.filters && typeof stored.filters === "object") {
      const raw = stored.filters as Record<string, unknown>;
      const restored = {
        ...DEFAULT_FILTERS,
        ...raw,
        date_from: raw.date_from ? new Date(String(raw.date_from)) : DEFAULT_FILTERS.date_from,
        date_to: raw.date_to ? new Date(String(raw.date_to)) : DEFAULT_FILTERS.date_to,
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
  const typeOptions = ["CHEQUE", "ONLINE", "CASH", "NEFT"];
  const statusOptions = ["POSTED", "UNPOSTED"];

  const handlePageSizeChange = (newPageSize: number) =>
    setPagination({ pageIndex: 0, pageSize: newPageSize });
  const handlePageChange = (newPage: number) =>
    setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));
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
    filters: OverseasReceiptFilters,
    searchValue: string,
  ) => {
    const cleaned = Object.entries(filters).reduce((acc, [key, value]) => {
      if (key === "day_book_name") return acc;
      if (key === "date_from" && value) acc.date_from = dayjs(value as Date).format("YYYY-MM-DD");
      else if (key === "date_to" && value) acc.date_to = dayjs(value as Date).format("YYYY-MM-DD");
      else if (typeof value === "string" && value.trim() !== "") acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    if (searchValue?.trim()) cleaned.search = searchValue;
    return cleaned;
  };

  const {
    data: receiptData = [],
    isLoading: receiptLoading,
    isFetching: receiptFetching,
    error: receiptError,
  } = useQuery({
    queryKey: [
      "overseas-receipt",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<ReceiptRow[]> => {
      try {
        const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);
        const payload =
          Object.keys(filtersPayload).length > 0
            ? { filters: { is_agent: true, ...filtersPayload } }
            : { filters: { is_agent: true } };
        setIsInitialLoad(false);
        const response = await apiCallProtected.post(
          `${URL.receiptFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        setShowFilters(false);
        const raw = response as any;
        const bodyCandidate = raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body = bodyCandidate != null ? (bodyCandidate as ReceiptFilterResponse | ReceiptRow[]) : null;
        if (!body) {
          setTotalRecords(0);
          return [];
        }
        const list = Array.isArray((body as ReceiptFilterResponse).data)
          ? ((body as ReceiptFilterResponse).data as ReceiptRow[])
          : Array.isArray(body) ? (body as ReceiptRow[]) : [];
        const totalFromBody = (body as ReceiptFilterResponse).total;
        setTotalRecords(totalFromBody != null ? Number(totalFromBody) : list.length);
        return list;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
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

  const isLoading = receiptFetching || receiptLoading || isInitialLoad;
  const tableData = receiptData ?? [];

  const columns = useMemo<MRT_ColumnDef<ReceiptRow>[]>(
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
        accessorKey: "day_book_name",
        header: "Day Book",
        size: 160,
      },
      {
        accessorKey: "receipt_no",
        header: "Receipt No",
        size: 160,
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 100,
        Cell:({ row }) => (
          <Text size="sm">
            {row.original.date
              ? dayjs(row.original?.date).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        size: 100,
      },
      {
        accessorKey: "amount",
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
          const isPosted = status === "POSTED";
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
                    onClick={() =>{
                      setStoreFilters(LIST_KEY, appliedFilters);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate("/overseas-receipt/view", {
                        state: {
                          ...(row.original as any),
                          documents:
                            (row.original as any)?.documents ??
                            (row.original as any)?.supporting_documents ??
                            [],
                        },
                      })
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
                        navigate("/overseas-receipt/edit", {
                          state: {
                            ...(row.original as any),
                            documents:
                              (row.original as any)?.documents ??
                              (row.original as any)?.supporting_documents ??
                              [],
                          },
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
                {isPosted && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        const {
                          documents: _documents,
                          supporting_documents: _supportingDocuments,
                          ...overseasReceiptDataWithoutDocuments
                        } = (row.original as any) ?? {};
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate("/overseas-receipt/reversal/create", {
                          state: overseasReceiptDataWithoutDocuments,
                        });
                      }}
                    >
                      <Group gap="sm">
                        <IconReceiptRefund
                          size={16}
                          style={{ color: "#2563EB" }}
                        />
                        <Text
                          size="sm"
                          style={{ fontFamily: "Inter, sans-serif" }}
                        >
                          Create Receipt Reversal
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
    [index, navigate, appliedFilters, search, setStoreFilters, setStoreSearch, setShouldRestore],
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
          color: "#334155",
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
              backgroundColor: "#F8FAFC",
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: "14px",
          fontFamily: "Inter",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
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
            c="#1E293B"
            style={{ fontFamily: "Inter", fontSize: "16px" }}
          >
            Overseas Receipt List
          </Text>

          <Group gap="xs" wrap="nowrap">
            <TextInput
              placeholder="Search..."
              leftSection={<IconSearch size={16} />}
              rightSection={
                search ? (
                  <ActionIcon variant="transparent" size="sm" onClick={() => setSearch("")} style={{ cursor: "pointer" }}>
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
                  borderRadius: "4px", fontSize: "14px", fontFamily: "Inter",
                  color: "#334155", height: "36px", border: "1px solid #D0D1D4",
                  "&:focus": { border: "1px solid #2563EB" },
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
                  border: showFilters ? "1px solid #2563EB" : "1px solid #737780",
                  color: showFilters ? "#2563EB" : "#737780",
                  "&:active": { border: "1px solid #2563EB", color: "#FFFFFF" },
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
                  backgroundColor: "#2563EB",
                  borderRadius: "4px",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontFamily: "Inter",
                  fontstyle: "semibold",
                  "&:hover": {
                    backgroundColor: "#2563EB",
                  },
                },
              }}
              onClick={() => {
                setStoreFilters(LIST_KEY, appliedFilters);
                setStoreSearch(LIST_KEY, search);
                setShouldRestore(LIST_KEY, true);
                navigate("/overseas-receipt/create");
              }}
            >
              Create New
            </Button>
          </Group>
        </Group>
      </Box>

      {showFilters && (
        <Box tt="capitalize" mb="sm" p="sm" style={{ borderRadius: "8px", border: "1px solid #E0E0E0", flexShrink: 0, height: "fit-content" }}>
          <Group justify="space-between" align="center" mb="sm" px="md" style={{ backgroundColor: "#F8FAFC", padding: "4px 8px" }}>
            <Text size="sm" fw={600} c="#1E293B" style={{ fontFamily: "Inter", fontSize: "14px" }}>Filter</Text>
            <ActionIcon variant="subtle" color="gray" onClick={() => setShowFilters(false)} aria-label="Close filters" size="sm">
              <IconX size={18} />
            </ActionIcon>
          </Group>

          <Grid gutter="sm" px="md" pt="xs" pb="sm">
            <Grid.Col span={3}>
              <SearchableSelect
                apiEndpoint={URL.daybookGet}
                label="Day Book"
                placeholder="Type Day Book"
                value={draftFilters.day_book_id}
                displayValue={draftFilters.day_book_name}
                onChange={(val, selectedData) =>
                  setDraftFilters((prev) => ({ ...prev, day_book_id: val || "", day_book_name: selectedData?.label || "" }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({ value: String(item.id ?? ""), label: String(item.name ?? "") })}
                searchFields={["name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <SearchableSelect
                apiEndpoint={URL.receipt}
                label="Receipt No"
                placeholder="Type Receipt No"
                value={draftFilters.receipt_no}
                onChange={(val) => setDraftFilters((prev) => ({ ...prev, receipt_no: val || "" }))}
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({ value: String(item.receipt_no ?? ""), label: String(item.receipt_no ?? "") })}
                searchFields={["receipt_no"]}
                size="xs"
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <SingleDateInput
                label="Date From"
                placeholder="Select Date"
                value={draftFilters.date_from}
                onChange={(date) =>
                  setDraftFilters((prev) => ({ ...prev, date_from: date }))
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
                  setDraftFilters((prev) => ({ ...prev, date_to: date }))
                }
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <Dropdown
                size="xs"
                label="Type"
                placeholder="Select Type"
                data={typeOptions}
                searchable
                value={draftFilters.type || null}
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, type: value || "" }))}
              />
            </Grid.Col>

            <Grid.Col span={3}>
              <Dropdown
                size="xs"
                label="Status"
                placeholder="Select Status"
                data={statusOptions}
                searchable
                value={draftFilters.status || null}
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value || "" }))}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" gap="sm" style={{ margin: "8px 8px" }}>
            <Button size="sm" variant="default" onClick={clearAllFilters} leftSection={<IconX size={16} />}
              styles={{ root: { borderRadius: "4px", fontSize: "14px", fontFamily: "Inter", fontWeight: 600, height: "36px", border: "1px solid #D0D1D4", color: "#1E293B" } }}>
              Clear Filters
            </Button>
            <Button size="sm" onClick={applyFilters} loading={isLoading} disabled={isLoading} leftSection={<IconFilter size={16} />}
              styles={{ root: { backgroundColor: "#2563EB", borderRadius: "4px", fontSize: "14px", fontFamily: "Inter", fontWeight: 600, height: "36px", "&:hover": { backgroundColor: "#0d4261" } } }}>
              Apply Filters
            </Button>
          </Group>
        </Box>
      )}

      {isLoading ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Loader size="lg" color="#2563EB" />
            <Text c="dimmed">Loading receipt data...</Text>
          </Stack>
        </Center>
      ) : receiptError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Stack align="center" gap="md">
            <Text c="dimmed">
              Error loading receipt data. Please try refreshing the page.
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
