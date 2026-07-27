import { useMemo, useState, useEffect } from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
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
  Center,
  Loader,
  Stack,
  TextInput,
  Grid,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
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
import { SearchableSelect } from "../../../components";
import { useListFilterStore } from "../../../store/listFilterStore";
import { useIsAdminUser } from "../../../hooks/useIsAdminUser";
import useAuthStore from "../../../store/authStore";
import { getActiveBranch } from "../../../utils/branchOdexCredentials";

const LIST_KEY = "EXCHANGE_RATE_MASTER";

type ExchangeRateMasterRow = {
  id?: number;
  sno?: number;
  country_id?: number;
  country_code?: string;
  country_name?: string;
  currency_id?: number;
  currency_code?: string;
  sell_rate?: string | number;
  buy_rate?: string | number;
  rate_date?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

type ExchangeRateMasterFilters = {
  country_code: string;
  currency_code: string;
  sell_rate: string;
  buy_rate: string;
};

type BranchWithCountry = {
  is_default?: boolean;
  country?: { country_code?: string };
};

function getBranchCountryCode(
  branches: BranchWithCountry[] | undefined,
  fallbackCountryCode?: string,
): string {
  const activeBranch = getActiveBranch(branches);
  return (
    activeBranch?.country?.country_code ||
    fallbackCountryCode ||
    ""
  ).trim();
}

export default function ExchangeRateMasterList() {
  const isAdmin = useIsAdminUser();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const defaultFilters = useMemo<ExchangeRateMasterFilters>(
    () => ({
      country_code: getBranchCountryCode(
        user?.branches as BranchWithCountry[] | undefined,
        user?.country?.country_code,
      ),
      currency_code: "",
      sell_rate: "",
      buy_rate: "",
    }),
    [user?.branches, user?.country?.country_code],
  );

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [draftFilters, setDraftFilters] =
    useState<ExchangeRateMasterFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<ExchangeRateMasterFilters>(defaultFilters);
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
      const restored = {
        ...defaultFilters,
        ...stored.filters,
      } as ExchangeRateMasterFilters;
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key]);

  const currentPage = pagination.pageIndex + 1;

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination({ pageIndex: 0, pageSize: newPageSize });
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
  };

  const clearAllFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const buildFiltersPayload = (
    filters: ExchangeRateMasterFilters,
    searchValue: string,
  ) => {
    const cleaned: Record<string, string | number> = {};
    if (filters.country_code?.trim())
      cleaned.country_code = filters.country_code.trim();
    if (filters.currency_code?.trim())
      cleaned.currency_code = filters.currency_code.trim();
    if (filters.sell_rate?.trim()) cleaned.sell_rate = filters.sell_rate.trim();
    if (filters.buy_rate?.trim()) cleaned.buy_rate = filters.buy_rate.trim();
    if (searchValue?.trim()) cleaned.search = searchValue.trim();
    return Object.keys(cleaned).length > 0 ? { filters: cleaned } : {};
  };

  const {
    data: exchangeRateData = [],
    isLoading: exchangeRateLoading,
    isFetching: exchangeRateFetching,
    error: exchangeRateError,
  } = useQuery({
    queryKey: [
      "exchange-rate-master",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async () => {
      try {
        const index = pagination.pageIndex * pagination.pageSize;
        const payload = buildFiltersPayload(appliedFilters, debouncedSearch);

        const response = await apiCallProtected.post(
          `${URL.exchangeRateMasterFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        );
        setIsInitialLoad(false);
        setShowFilters(false);

        const data = response as {
          data?: ExchangeRateMasterRow[];
          total?: number;
        };
        if (data && Array.isArray(data.data)) {
          setTotalRecords(data.total || data.data.length);
          return data.data;
        }
        setTotalRecords(0);
        return [];
      } catch (error) {
        console.error("Error fetching Exchange Rate Master data:", error);
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

  const isLoading =
    exchangeRateFetching || exchangeRateLoading || isInitialLoad;
  const tableData = exchangeRateData ?? [];

  const columns = useMemo<MRT_ColumnDef<ExchangeRateMasterRow>[]>(
    () => [
      {
        accessorKey: "sno",
        header: "S.No",
        size: 60,
        minSize: 50,
        enableColumnFilter: false,
        enableSorting: false,
      },
      {
        accessorKey: "currency_code",
        header: "Currency",
        minSize: 100,
      },
      {
        accessorKey: "rate_date",
        header: "Rate Date",
        minSize: 120,
        Cell: ({ row }) => {
          const value = row.original.rate_date;
          if (!value) return "-";
          const datePart = String(value).slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            const [y, m, d] = datePart.split("-");
            return `${d}-${m}-${y}`;
          }
          return String(value);
        },
      },
      {
        accessorKey: "sell_rate",
        header: "Sell Rate",
        minSize: 120,
      },
      {
        accessorKey: "buy_rate",
        header: "Buy Rate",
        minSize: 120,
      },
      {
        id: "actions",
        header: "Actions",
        size: 50,
        Cell: ({ row }) => (
          <Menu withinPortal position="bottom-start" shadow="sm" radius="md">
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
                    navigate("/master/exchange-rate-master/edit", {
                      state: row.original,
                    });
                  }}
                >
                  <Group gap="sm">
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
    [navigate, appliedFilters, search, setStoreFilters, setStoreSearch, setShouldRestore],
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
    state: { pagination },
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
            Exchange Rate Master
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
                  border: showFilters
                    ? "1px solid #105476"
                    : "1px solid #737780",
                  color: showFilters ? "#105476" : "#737780",
                },
              }}
            >
              <IconFilter size={18} />
            </ActionIcon>
            {isAdmin && (
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
                    "&:hover": { backgroundColor: "#105476" },
                  },
                }}
                onClick={() => {
                  setStoreFilters(LIST_KEY, appliedFilters);
                  setStoreSearch(LIST_KEY, search);
                  setShouldRestore(LIST_KEY, true);
                  navigate("/master/exchange-rate-master/create");
                }}
              >
                Create New
              </Button>
            )}
          </Group>
        </Group>
      </Box>

      {showFilters && (
        <Box
          mb="sm"
          p="sm"
          style={{
            borderRadius: "8px",
            border: "1px solid #E0E0E0",
            flexShrink: 0,
          }}
        >
          <Group
            justify="space-between"
            align="center"
            mb="sm"
            px="md"
            style={{ backgroundColor: "#F8FAFC", padding: "4px 8px" }}
          >
            <Text
              size="sm"
              fw={600}
              c="#1E293B"
              style={{ fontFamily: "Inter" }}
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
                apiEndpoint={URL.country}
                label="Country"
                placeholder="Search country code..."
                value={draftFilters.country_code || null}
                displayValue={draftFilters.country_code || undefined}
                onChange={(val) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    country_code: val || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => ({
                  value: String(
                    (item as { country_code?: string }).country_code ?? "",
                  ),
                  label: String(
                    (item as { country_code?: string; country_name?: string })
                      .country_code ??
                      (item as { country_name?: string }).country_name ??
                      "",
                  ),
                })}
                searchFields={["country_code", "country_name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <SearchableSelect
                apiEndpoint={URL.currencyMaster}
                label="Currency"
                placeholder="Search currency code..."
                value={draftFilters.currency_code || null}
                displayValue={draftFilters.currency_code || undefined}
                onChange={(val) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    currency_code: val || "",
                  }))
                }
                dropdownZIndex={1000}
                minSearchLength={1}
                displayFormat={(item) => {
                  const code = String(
                    (item as { currency_code?: string; code?: string })
                      .currency_code ??
                      (item as { code?: string }).code ??
                      "",
                  );
                  return { value: code, label: code };
                }}
                searchFields={["currency_code", "code", "name"]}
                size="xs"
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <TextInput
                label="Sell Rate"
                placeholder="e.g. 80.5"
                size="xs"
                value={draftFilters.sell_rate}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    sell_rate: e.currentTarget.value,
                  }))
                }
                styles={{
                  label: {
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#424242",
                    marginBottom: 4,
                    fontFamily: "Inter",
                  },
                  input: {
                    fontSize: "13px",
                    height: "36px",
                    fontFamily: "Inter",
                  },
                }}
              />
            </Grid.Col>

            <Grid.Col span={2.4}>
              <TextInput
                label="Buy Rate"
                placeholder="e.g. 79.25"
                size="xs"
                value={draftFilters.buy_rate}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    buy_rate: e.currentTarget.value,
                  }))
                }
                styles={{
                  label: {
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#424242",
                    marginBottom: 4,
                    fontFamily: "Inter",
                  },
                  input: {
                    fontSize: "13px",
                    height: "36px",
                    fontFamily: "Inter",
                  },
                }}
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
                  color: "#1E293B",
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
                  "&:hover": { backgroundColor: "#0d4261" },
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
            <Text c="dimmed">Loading Exchange Rate Master data...</Text>
          </Stack>
        </Center>
      ) : exchangeRateError ? (
        <Center py="xl" style={{ flex: 1 }}>
          <Text c="dimmed">
            Error loading Exchange Rate Master data. Please try refreshing the
            page.
          </Text>
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
          />
        </>
      )}
    </Card>
  );
}
