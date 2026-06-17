import { useCallback, useEffect, useMemo, useState } from "react";
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
  Center,
  Grid,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCircleCheck,
  IconClock,
  IconCoin,
  IconCreditCard,
  IconDots,
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
import {
  Dropdown,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  ERPListStatPill,
  SingleDateInput,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  erpToolbarPrimaryButtonStyles,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { useListFilterStore } from "../../../store/listFilterStore";
import dayjs from "dayjs";
import FormTextInput from "../../../components/FormTextInput";
import useDateFormat from "../../../hooks/useDateFormat";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";

type SupplierInvoiceRow = Record<string, unknown> & {
  id?: number | string;
  sno?: number;
  crj_number?: string;
  Inv_Crn_no?: string;
  agent_name?: string;
  job_id?: string;
  shipment_ids?: string[];
  currency_code?: string;
  date?: string;
  Inv_crn_amount?: number | string;
  status?: string;
  [key: string]: unknown;
};

/** `summary` on `supplierInvoiceFilter` — totals are filter-scoped. */
type SupplierInvoiceListSummary = {
  total_shipments?: number;
  status_counts?: {
    posted?: number;
    unposted?: number;
  };
};

type SupplierInvoiceListQueryResult = {
  data: SupplierInvoiceRow[];
  summary?: SupplierInvoiceListSummary;
};

type SupplierInvoiceFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  total_count?: number;
  data?: SupplierInvoiceRow[];
  summary?: SupplierInvoiceListSummary;
};

const LIST_KEY = "SUPPLIER_INVOICE_MASTER";

type SupplierInvoiceFilters = {
  invoice_no: string;
  agent_name: string;
  job_id: string;
  shipment_id: string;
  date_from: Date | null;
  date_to: Date | null;
  status: string;
};

type SupplierInvoiceColumnVisibility = {
  sno: boolean;
  invoice_no: boolean;
  agent_name: boolean;
  job_id: boolean;
  shipment_ids: boolean;
  date: boolean;
  currency_code: boolean;
  Inv_crn_amount: boolean;
  status: boolean;
};

const supplierInvoiceColumnDefault: SupplierInvoiceColumnVisibility = {
  sno: true,
  invoice_no: true,
  agent_name: true,
  job_id: true,
  shipment_ids: true,
  date: true,
  currency_code: true,
  Inv_crn_amount: true,
  status: true,
};

const supplierInvoiceColumnLabels: Record<keyof SupplierInvoiceColumnVisibility, string> = {
  sno: "S.No",
  invoice_no: "Invoice No",
  agent_name: "Agent / Supplier",
  job_id: "Job Id",
  shipment_ids: "Shipment Id",
  date: "Date",
  currency_code: "Currency",
  Inv_crn_amount: "Amount",
  status: "Status",
};

function supplierInvoiceColumnId<T extends Record<string, unknown>>(
  col: MRT_ColumnDef<T>,
): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

function SupplierInvoiceMaster() {
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

  const DEFAULT_FILTERS: SupplierInvoiceFilters = {
    invoice_no: "",
    agent_name: "",
    job_id: "",
    shipment_id: "",
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
  const [debouncedSearch] = useDebouncedValue(search, 1000);

  const [visibleColumns, setVisibleColumns] = useState<SupplierInvoiceColumnVisibility>(
    () => ({ ...supplierInvoiceColumnDefault }),
  );

  /**
   * Column-header filtering: which header is currently in "edit" mode.
   * Lifted to the page so opening a new header collapses any prior editor,
   * and so the editor state survives MRT re-renders triggered by filter
   * changes flowing through the column memo's deps.
   */
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId(id);
  }, []);
  const collapseHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId((cur) => (cur === id ? null : cur));
  }, []);

  /**
   * Header-filter writes update BOTH draftFilters and appliedFilters at once
   * (instant filtering, mirroring the EnquiryMaster column-header UX). This
   * keeps the advanced filter section visually in sync, resets pagination to
   * page 1, and persists the new filter to the global list-filter store so
   * the value is preserved when navigating back from associated pages.
   */
  const commitHeaderFilters = useCallback(
    (updater: (prev: SupplierInvoiceFilters) => SupplierInvoiceFilters) => {
      setDraftFilters((prev) => {
        const next = updater(prev);
        setAppliedFilters(next);
        setStoreFilters(LIST_KEY, next);
        return next;
      });
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [setStoreFilters],
  );

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

  const index = pagination.pageIndex * pagination.pageSize;

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const buildFiltersPayload = (
    filters: SupplierInvoiceFilters,
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
      } else if (typeof value === "string" && value.trim() !== "") {
        cleaned[key] = value;
      }
    });

    if (searchValue?.trim()) cleaned.search = searchValue;

    return cleaned;
  };

  const {
    data: supplierListResult,
    isLoading: supplierLoading,
    isFetching: supplierFetching,
    error: supplierError,
  } = useQuery<SupplierInvoiceListQueryResult>({
    queryKey: [
      "supplier-invoice",
      pagination.pageIndex,
      pagination.pageSize,
      JSON.stringify(appliedFilters),
      debouncedSearch,
    ],
    queryFn: async (): Promise<SupplierInvoiceListQueryResult> => {
      try {
        const filtersPayload = buildFiltersPayload(appliedFilters, debouncedSearch);
        const payload =
          Object.keys(filtersPayload).length > 0
            ? { filters: filtersPayload }
            : { filters: {} };

        setIsInitialLoad(false);

        const response = (await apiCallProtected.post(
          `${URL.supplierInvoiceFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        )) as SupplierInvoiceFilterResponse;

        const list = Array.isArray(response?.data) ? response.data : [];

        const totalEnvelope = response as Record<string, unknown>;
        const listTotal = getBookingShipmentFilterListTotal(totalEnvelope, list, index);
        const rawSummary = response?.summary;
        const summary: SupplierInvoiceListSummary | undefined =
          rawSummary && typeof rawSummary === "object" && !Array.isArray(rawSummary)
            ? rawSummary
            : undefined;
        const summaryTotal = summary?.total_shipments;
        const total =
          typeof summaryTotal === "number" && !Number.isNaN(summaryTotal)
            ? summaryTotal
            : listTotal;
        setTotalRecords(total);
        return { data: list, summary };
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setTotalRecords(0);
          return { data: [], summary: undefined };
        }
        throw err;
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const supplierData = supplierListResult?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  const isLoading = supplierFetching || supplierLoading || isInitialLoad;
  const tableData = supplierData ?? [];

  const border = "#e2e8f0";
  const muted = "#64748b";
  const fg = "#0f172a";
  const primary = "#105476";
  const pageBg = "#F0F4F8";
  const cardBg = "#ffffff";
  const erpTheme: ErpListTheme = {
    border,
    muted,
    fg,
    primary,
    headerBg: "#f8fafc",
    pageBg,
    cardBg,
    fontSans: "'Geist', sans-serif",
  };

  const listStats = useMemo(() => {
    let pageAmount = 0;
    for (const r of tableData) {
      const a = Number(r.Inv_crn_amount);
      if (!Number.isNaN(a)) pageAmount += a;
    }
    const summary = supplierListResult?.summary;
    if (summary) {
      const sc = summary.status_counts ?? {};
      return {
        total: summary.total_shipments ?? totalRecords,
        posted: sc.posted ?? 0,
        unposted: sc.unposted ?? 0,
        pageAmount,
      };
    }
    let posted = 0;
    let unposted = 0;
    for (const r of tableData) {
      const s = String(r.status ?? "").toUpperCase();
      if (s === "POSTED") posted += 1;
      else if (s === "UNPOSTED") unposted += 1;
    }
    return { total: totalRecords, posted, unposted, pageAmount };
  }, [tableData, supplierListResult?.summary, totalRecords]);

  const filterFieldStyles = erpListFilterUnifiedMantineStyles(erpTheme);
  const formTextFilterStyles = useMemo(
    () => ({
      label: { ...filterFieldStyles.label, fontSize: 12, fontWeight: 500, marginBottom: 4 },
      input: { ...filterFieldStyles.input, minHeight: 32, fontSize: 12, fontFamily: erpTheme.fontSans },
    }),
    [filterFieldStyles, erpTheme.fontSans],
  );

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(visibleColumns) as (keyof SupplierInvoiceColumnVisibility)[]).map(
        (key) => ({
          id: String(key),
          label: supplierInvoiceColumnLabels[key],
          checked: visibleColumns[key],
          onToggle: () =>
            setVisibleColumns((prev) => ({
              ...prev,
              [key]: !prev[key],
            })),
        }),
      ),
    [visibleColumns],
  );

  const allColumns = useMemo<MRT_ColumnDef<SupplierInvoiceRow>[]>(
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
        id: "invoice_no",
        header: "Invoice No",
        size: 160,
        accessorFn: (row) => (row.crj_number ?? "") as string,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Invoice No"
            value={appliedFilters.invoice_no}
            displayValue={appliedFilters.invoice_no}
            theme={erpTheme}
            placeholder="Filter Invoice No"
            isEditing={editingHeaderId === "invoice_no"}
            onStartEdit={() => openHeaderEditor("invoice_no")}
            onStopEdit={() => collapseHeaderEditor("invoice_no")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, invoice_no: next }))
            }
          />
        ),
      },
      {
        accessorKey: "agent_name",
        header: "Agent / Supplier",
        size: 200,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Agent / Supplier"
            value={appliedFilters.agent_name}
            displayValue={appliedFilters.agent_name}
            theme={erpTheme}
            placeholder="Filter Agent"
            isEditing={editingHeaderId === "agent_name"}
            onStartEdit={() => openHeaderEditor("agent_name")}
            onStopEdit={() => collapseHeaderEditor("agent_name")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, agent_name: next }))
            }
          />
        ),
      },
      {
        accessorKey: "job_id",
        header: "Job Id",
        size: 150,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Job Id"
            value={appliedFilters.job_id}
            displayValue={appliedFilters.job_id}
            theme={erpTheme}
            placeholder="Filter Job Id"
            isEditing={editingHeaderId === "job_id"}
            onStartEdit={() => openHeaderEditor("job_id")}
            onStopEdit={() => collapseHeaderEditor("job_id")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, job_id: next }))
            }
          />
        ),
        Cell: ({ row }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {row.original.job_id ? String(row.original.job_id) : "-"}
          </Text>
        ),
      },
      {
        id: "shipment_ids",
        accessorKey: "shipment_ids",
        header: "Shipment Id",
        size: 180,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Shipment Id"
            value={appliedFilters.shipment_id}
            displayValue={appliedFilters.shipment_id}
            theme={erpTheme}
            placeholder="Filter Shipment Id"
            isEditing={editingHeaderId === "shipment_id"}
            onStartEdit={() => openHeaderEditor("shipment_id")}
            onStopEdit={() => collapseHeaderEditor("shipment_id")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, shipment_id: next }))
            }
          />
        ),
        Cell: ({ row }) => {
          const shipmentIds = row.original.shipment_ids;
          if (Array.isArray(shipmentIds) && shipmentIds.length > 0) {
            return (
              <Stack gap={2}>
                {shipmentIds.map((shipmentId, shipmentIndex) => (
                  <Text
                    key={`${row.original.id ?? row.index}-${shipmentIndex}`}
                    size="sm"
                    style={{ fontFamily: erpTheme.fontSans }}
                  >
                    {String(shipmentId)}
                  </Text>
                ))}
              </Stack>
            );
          }

          const fallbackShipmentId = row.original.shipment_id;
          return (
            <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
              {fallbackShipmentId ? String(fallbackShipmentId) : "-"}
            </Text>
          );
        },
      },
      {
        accessorKey: "date",
        header: "Date",
        size: 140,
        Cell: ({ row }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {row.original.date
              ? dayjs(String(row.original.date)).format(dateFormat)
              : "-"}
          </Text>
        ),
      },
      {
        accessorKey: "currency_code",
        header: "Currency",
        size: 100,
        Cell: ({ row }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {row.original.currency_code
              ? String(row.original.currency_code)
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
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Status"
            value={appliedFilters.status}
            displayValue={appliedFilters.status}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "status"}
            onStartEdit={() => openHeaderEditor("status")}
            onStopEdit={() => collapseHeaderEditor("status")}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                placeholder="Select Status"
                searchable
                clearable
                size="xs"
                data={["POSTED", "UNPOSTED"]}
                value={appliedFilters.status || ""}
                onChange={(value) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    status: value || "",
                  }));
                  if (value) onClose();
                }}
                comboboxProps={{ zIndex: 1000 }}
                classNames={erpListGeistSelectClassNames}
                styles={filterFieldStyles}
              />
            )}
          />
        ),
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
                : "#105476";
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
            <Menu
              withinPortal
              position="bottom-end"
              shadow="md"
              width={220}
              styles={erpListGeistMenuDropdownStyles}
              classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
            >
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px={10} py={5}>
                  <UnstyledButton
                    onClick={() => {
                      setStoreFilters(LIST_KEY, appliedFilters);
                      setStoreSearch(LIST_KEY, search);
                      setShouldRestore(LIST_KEY, true);
                      navigate("/supplier-invoice/view", {
                        state: row.original,
                      });
                    }}
                  >
                    <Group gap="sm">
                      <IconEye size={16} color={primary} />
                      <Text
                        size="sm"
                        style={{ fontFamily: erpTheme.fontSans }}
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
                        navigate("/supplier-invoice/edit", {
                          state: row.original,
                        });
                      }}
                    >
                      <Group gap="sm">
                        <IconEdit size={16} color={primary} />
                        <Text
                          size="sm"
                          style={{ fontFamily: erpTheme.fontSans }}
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
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate("/supplier-invoice/reversal/create", {
                          state: row.original,
                        });
                      }}
                    >
                      <Group gap="sm">
                        <IconReceiptRefund
                          size={16}
                          color={primary}
                        />
                        <Text
                          size="sm"
                          style={{ fontFamily: erpTheme.fontSans }}
                        >
                          Create Supplier Invoice Reverse
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
      erpTheme,
      dateFormat,
      primary,
      editingHeaderId,
      openHeaderEditor,
      collapseHeaderEditor,
      commitHeaderFilters,
      filterFieldStyles,
    ],
  );

  const columns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = supplierInvoiceColumnId(col);
        if (id === "actions") return true;
        return visibleColumns[id as keyof SupplierInvoiceColumnVisibility] !== false;
      }),
    [allColumns, visibleColumns],
  );

  const table = useMantineReactTable({
    columns,
    /*
     * During a fetch we pass an empty data array so MRT renders
     * `renderEmptyRowsFallback` (the loader) inside `<tbody>` while keeping
     * `<thead>` (with the column-header filter inputs) and the pagination
     * footer mounted. Mirrors EnquiryListNativeTables' loader-in-body UX.
     */
    data: isLoading ? [] : tableData,
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
    onPaginationChange: setPagination,
    rowCount: totalRecords,
    state: {
      pagination,
    },
    renderEmptyRowsFallback: () => (
      <Center
        py={80}
        style={{ width: "100%", backgroundColor: cardBg }}
        className="erp-header-filter-fade"
      >
        {isLoading ? (
          <Stack align="center" gap="md">
            <Loader size="lg" color={primary} />
            <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
              Loading supplier invoice data…
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            No supplier invoice data found
          </Text>
        )}
      </Center>
    ),
    mantineTableProps: {
      striped: false,
      highlightOnHover: true,
      withTableBorder: false,
      withColumnBorders: false,
    },
    mantinePaperProps: {
      shadow: "none",
      p: 0,
      radius: 0,
      withBorder: false,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        backgroundColor: "transparent",
      },
    },
    mantineTableBodyCellProps: ({ column }) => {
      const colSize = column.getSize();
      const isActions = column.id === "actions";
      const extraStyles = isActions
        ? {
            // Pinned-right Actions cell. `minWidth: 80px` matches the head
            // cell so the sticky body cell and sticky head cell stay the
            // same width. `zIndex: 2` stays BELOW the sticky head
            // (`zIndex: 4`) so the head paints over the body cell at the
            // bottom-right corner during horizontal scroll.
            position: "sticky" as const,
            right: 0,
            minWidth: "80px",
            zIndex: 2,
            borderLeft: `1px solid ${border}`,
            boxShadow: "1px -2px 4px 0px #00000040",
          }
        : {};
      return {
        style: {
          /*
           * Pin cell width to the column's declared `size` so the column
           * cannot resize when its header swaps between the static label
           * and the inline filter editor.
           */
          width: colSize,
          minWidth: colSize,
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: cardBg,
          ...extraStyles,
        },
      };
    },
    mantineTableHeadCellProps: ({ column }) => {
      const colSize = column.getSize();
      const isActions = column.id === "actions";
      const extraStyles = isActions
        ? {
            // Pinned-right Actions header. `zIndex: 4` keeps the sticky
            // head cell above the sticky body cell (`zIndex: 2`) at the
            // bottom-right corner.
            position: "sticky" as const,
            right: 0,
            minWidth: "80px",
            zIndex: 4,
            backgroundColor: erpTheme.headerBg,
            boxShadow: "0px -2px 4px 0px #00000040",
          }
        : {};
      return {
        style: {
          /*
           * Pin head cell width to the column's declared `size` (matches the
           * body cell width) so toggling between the column label and the
           * inline filter editor never resizes the header.
           */
          width: colSize,
          minWidth: colSize,
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: erpTheme.headerBg,
          borderBottom: `1px solid ${border}`,
          /*
           * Stable header cell height so swapping between the column label
           * and the inline filter editor never resizes the row. Matches the
           * EnquiryMaster header row height (52.4 → 52).
           */
          minHeight: 52,
          height: 52,
          verticalAlign: "middle" as const,
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
    <MantineProvider theme={erpListGeistMantineTheme}>
      <Box
        className={ERP_LIST_GEIST_ROOT_CLASS}
        style={{ ...erpListGeistRootTypography, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <ERPListScreen
          theme={erpTheme}
          className={ERP_LIST_GEIST_ROOT_CLASS}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconCreditCard size={14} color={primary} />}
                  value={listStats.total}
                  label="Total"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconCircleCheck size={14} color="#059669" />}
                  iconBackground="#d1fae5"
                  iconColor="#059669"
                  value={listStats.posted}
                  label="Posted"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconClock size={14} color="#d97706" />}
                  iconBackground="#fef3c7"
                  iconColor="#d97706"
                  value={listStats.unposted}
                  label="Unposted"
                />
              </>
            ),
            // secondary: (
            //   <Group gap={8} wrap="nowrap" align="center">
            //     <IconCoin size={16} color={muted} style={{ flexShrink: 0 }} />
            //     <Text fw={600} size="sm" c={fg} style={{ fontFamily: erpTheme.fontSans }} component="span">
            //       {listStats.pageAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            //     </Text>
            //     <Text size="xs" c={muted} component="span">
            //       on this page
            //     </Text>
            //   </Group>
            // ),
            actions: (
              <>
                <TextInput
                  placeholder="Search…"
                  leftSection={<IconSearch size={16} />}
                  rightSection={
                    search ? (
                      <ActionIcon
                        variant="transparent"
                        size="sm"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                        style={{ cursor: "pointer" }}
                      >
                        <IconX size={16} />
                      </ActionIcon>
                    ) : null
                  }
                  w={260}
                  size="xs"
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={{
                    input: {
                      fontFamily: erpTheme.fontSans,
                      fontSize: 12,
                      height: 32,
                      borderColor: border,
                    },
                  }}
                />
                <ERPListColumnToggleMenu
                  theme={erpTheme}
                  items={columnToggleItems}
                  menuStyles={erpListGeistMenuDropdownStyles}
                  classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                />
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  leftSection={<IconFilter size={14} />}
                  onClick={() => setShowFilters((s) => !s)}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  styles={erpToolbarPrimaryButtonStyles(erpTheme)}
                  onClick={() => {
                    setStoreFilters(LIST_KEY, appliedFilters);
                    setStoreSearch(LIST_KEY, search);
                    setShouldRestore(LIST_KEY, true);
                    navigate("/supplier-invoice/create");
                  }}
                >
                  Create New
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle:
              "Refine by invoice no., agent, job id, shipment id, date range, or status",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={erpTheme}
                onClear={clearAllFilters}
                onApply={applyFilters}
                applyLoading={isLoading}
                applyDisabled={isLoading}
              />
            ),
            children: (
              <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
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
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
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
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Job Id"
                      placeholder="Type Job Id"
                      value={draftFilters.job_id}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          job_id: e.currentTarget.value,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Shipment Id"
                      placeholder="Type Shipment Id"
                      value={draftFilters.shipment_id}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          shipment_id: e.currentTarget.value,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Date From"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.date_from}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          date_from: date,
                        }))
                      }
                      size="xs"
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: { ...filterFieldStyles.input, minHeight: 32 },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Date To"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.date_to}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          date_to: date,
                        }))
                      }
                      size="xs"
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: { ...filterFieldStyles.input, minHeight: 32 },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
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
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
              </Grid>
            ),
          }}
          table={{
            footer: (
              <ERPListPaginationFooter
                theme={erpTheme}
                totalRecords={totalRecords}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                onPageIndexChange={(idx) =>
                  setPagination((prev) => ({ ...prev, pageIndex: idx }))
                }
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={["10", "25", "50"]}
                selectClassNames={erpListGeistSelectClassNames}
              />
            ),
            children: supplierError ? (
              <Center py="xl" style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}>
                <Text size="sm" c="dimmed" style={{ fontFamily: erpTheme.fontSans }}>
                  Error loading supplier invoice data. Please try refreshing the page.
                </Text>
              </Center>
            ) : (
              /*
               * Always render the table so `<thead>` (column-header filters)
               * and the pagination footer stay visible. While loading, MRT
               * shows `renderEmptyRowsFallback` (the loader) inside `<tbody>`
               * only — matching EnquiryListNativeTables' UX.
               */
              <MantineReactTable table={table} />
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}

export default SupplierInvoiceMaster;
