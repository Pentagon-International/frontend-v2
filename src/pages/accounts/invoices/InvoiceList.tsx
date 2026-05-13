import { useCallback, useEffect, useMemo, useState } from "react";
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
  IconClock,
  IconCreditCard,
  IconDots,
  IconEdit,
  IconEye,
  IconFilter,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Dropdown,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListScreen,
  ERPListStatPill,
  SearchableSelect,
  SingleDateInput,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpToolbarOutlineButtonStyles,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import dayjs from "dayjs";
import type { ErpListTheme } from "../../../components";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import FormTextInput from "../../../components/FormTextInput";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { useListFilterStore } from "../../../store/listFilterStore";

const LIST_KEY = "INVOICE_LIST_MASTER";

type InvoiceFilterRow = Record<string, unknown> & {
  id?: number | string;
  sno?: number;
  bill_to_name?: string;
  gstn?: string | null;
  shipment_no?: string;
  state_name?: string;
  document_no?: string;
  document_date?: string;
  status?: string;
  document_type?: string;
};

type InvoiceFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number | null;
  total?: number;
  data?: InvoiceFilterRow[];
};

type InvoiceListQueryResult = {
  data: InvoiceFilterRow[];
};

type InvoiceListFilters = {
  bill_to: string;
  party_display: string | null;
  document_no: string;
  shipment_no: string;
  state_id: string;
  state_name: string;
  gstn: string;
  document_date_from: Date | null;
  document_date_to: Date | null;
};

async function fetchStateMaster(): Promise<Array<Record<string, unknown>>> {
  try {
    const response = await getAPICall(`${URL.state}`, API_HEADER);
    if (Array.isArray(response))
      return response as Array<Record<string, unknown>>;
    if (response && typeof response === "object" && "data" in response) {
      const d = (response as { data: unknown }).data;
      return Array.isArray(d) ? (d as Array<Record<string, unknown>>) : [];
    }
    return [];
  } catch {
    return [];
  }
}

const columnLabels = {
  sno: "S.No",
  bill_to_name: "Party name",
  document_no: "Document No",
  document_date: "Document date",
  shipment_no: "Shipment No",
  gstn: "GSTN",
  state_name: "State",
} as const;

type ColumnKey = keyof typeof columnLabels;

const columnDefault: Record<ColumnKey, boolean> = {
  sno: true,
  bill_to_name: true,
  document_no: true,
  document_date: true,
  shipment_no: true,
  gstn: true,
  state_name: true,
};

function columnId<T extends Record<string, unknown>>(col: MRT_ColumnDef<T>): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

function formatCell(value: unknown): string {
  if (value == null || value === "") return "-";
  return String(value);
}

function rowInvoiceId(row: InvoiceFilterRow): string | null {
  const raw = row.id;
  if (raw == null || raw === "") return null;
  return String(raw);
}

function isCreditNoteRow(row: InvoiceFilterRow): boolean {
  return String(row.document_type ?? "").toUpperCase() === "CRN";
}

export default function InvoiceList() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Default date window for the list query: first day of the current month
   * through today (mirrors the ReceiptMaster pattern). These are evaluated
   * on every mount so the window stays current.
   */
  const defaultDateFrom = useMemo(() => dayjs().startOf("month").toDate(), []);
  const defaultDateTo = useMemo(() => dayjs().toDate(), []);

  const DEFAULT_FILTERS = useMemo<InvoiceListFilters>(
    () => ({
      bill_to: "",
      party_display: null,
      document_no: "",
      shipment_no: "",
      state_id: "",
      state_name: "",
      gstn: "",
      document_date_from: defaultDateFrom,
      document_date_to: defaultDateTo,
    }),
    [defaultDateFrom, defaultDateTo],
  );

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    () => ({ ...columnDefault }),
  );
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRestoring, setIsRestoring] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<InvoiceListFilters>(
    () => DEFAULT_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<InvoiceListFilters>(
    () => DEFAULT_FILTERS,
  );

  /**
   * Global list-filter store hooks. Used to preserve search, filters and
   * code/name display labels across navigation to associated pages
   * (view / edit) so the user lands back on the list with the same context.
   */
  const getStoreState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

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
   * keeps the advanced filter section visually in sync, resets pagination
   * to page 1, and persists the new value to the global list-filter store
   * so it survives navigation to associated pages.
   */
  const commitHeaderFilters = useCallback(
    (updater: (prev: InvoiceListFilters) => InvoiceListFilters) => {
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

  const index = pagination.pageIndex * pagination.pageSize;

  useEffect(() => {
    if (isRestoring) return;
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [debouncedSearch, isRestoring]);

  /**
   * Restoration effect: on every navigation into this page, if the store has
   * `shouldRestore: true` for this LIST_KEY, restore search + filters + the
   * code/name display labels (party_display, state_name) so the UI shows
   * back exactly what the user had. After applying, flip shouldRestore off
   * so a fresh visit (e.g. via sidebar) starts clean.
   */
  useEffect(() => {
    const stored = getStoreState(LIST_KEY);
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
      const restored: InvoiceListFilters = {
        ...DEFAULT_FILTERS,
        ...(raw as Partial<InvoiceListFilters>),
        document_date_from: raw.document_date_from
          ? new Date(String(raw.document_date_from))
          : DEFAULT_FILTERS.document_date_from,
        document_date_to: raw.document_date_to
          ? new Date(String(raw.document_date_to))
          : DEFAULT_FILTERS.document_date_to,
      };
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters({ ...DEFAULT_FILTERS });
    setAppliedFilters({ ...DEFAULT_FILTERS });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const buildPayload = (filters: InvoiceListFilters, searchValue: string) => {
    const out: Record<string, string | number | boolean> = {
      status: "UNPOSTED",
    };
    if (searchValue?.trim()) out.search = searchValue.trim();
    if (filters.bill_to.trim()) out.bill_to = filters.bill_to.trim();
    if (filters.shipment_no.trim()) out.shipment_no = filters.shipment_no.trim();
    if (filters.state_id.trim()) {
      const n = Number(filters.state_id);
      if (!Number.isNaN(n) && n > 0) out.state_id = n;
    }
    if (filters.document_no.trim()) out.document_no = filters.document_no.trim();
    if (filters.gstn.trim()) out.gstn = filters.gstn.trim();
    if (filters.document_date_from) {
      out.document_date_from = dayjs(filters.document_date_from).format(
        "YYYY-MM-DD",
      );
    }
    if (filters.document_date_to) {
      out.document_date_to = dayjs(filters.document_date_to).format(
        "YYYY-MM-DD",
      );
    }
    return { filters: out };
  };

  const { data: stateRows = [] } = useQuery({
    queryKey: ["invoice-list-state-master"],
    queryFn: fetchStateMaster,
    staleTime: Infinity,
  });

  const stateOptions = useMemo(() => {
    if (!Array.isArray(stateRows)) return [];
    return stateRows
      .map((item) => ({
        value: String(item.id ?? ""),
        label: String(item.state_name ?? item.name ?? ""),
      }))
      .filter((o) => o.value !== "" && o.label !== "");
  }, [stateRows]);

  const {
    data: listResult,
    isLoading,
    isFetching,
    error: listError,
  } = useQuery<InvoiceListQueryResult>({
    queryKey: [
      "account-unposted-invoices",
      pagination.pageIndex,
      pagination.pageSize,
      debouncedSearch,
      JSON.stringify(appliedFilters),
    ],
    queryFn: async (): Promise<InvoiceListQueryResult> => {
      try {
        setIsInitialLoad(false);
        const payload = buildPayload(appliedFilters, debouncedSearch);
        const response = (await apiCallProtected.post(
          `${URL.invoiceFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        )) as Record<string, unknown>;


        const raw = response as { data?: unknown };
        const bodyCandidate =
          raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body = bodyCandidate != null
          ? (bodyCandidate as InvoiceFilterResponse | InvoiceFilterRow[])
          : null;

        if (!body) {
          setTotalRecords(0);
          return { data: [] };
        }

        const list = Array.isArray((body as InvoiceFilterResponse).data)
          ? ((body as InvoiceFilterResponse).data as InvoiceFilterRow[])
          : Array.isArray(body)
            ? (body as InvoiceFilterRow[])
            : [];

        const totalEnvelope =
          body != null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          ("total" in body || "index" in body)
            ? (body as unknown as Record<string, unknown>)
            : (raw as Record<string, unknown>);
        const listTotal = getBookingShipmentFilterListTotal(totalEnvelope, list, index);
        setTotalRecords(listTotal);
        return { data: list };
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setTotalRecords(0);
          return { data: [] };
        }
        throw err;
      }
    },
    enabled: !isRestoring && search === debouncedSearch,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const tableData = listResult?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  const loading = isFetching || isLoading || isInitialLoad;

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

  const filterFieldStyles = erpListFilterUnifiedMantineStyles(erpTheme);
  const formTextFilterStyles = useMemo(
    () => ({
      label: {
        ...filterFieldStyles.label,
        fontSize: 12,
        fontWeight: 500,
        marginBottom: 4,
      },
      input: {
        ...filterFieldStyles.input,
        minHeight: 32,
        fontSize: 12,
        fontFamily: erpTheme.fontSans,
      },
    }),
    [filterFieldStyles, erpTheme.fontSans],
  );

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(columnLabels) as ColumnKey[]).map((key) => ({
        id: String(key),
        label: columnLabels[key],
        checked: visibleColumns[key],
        onToggle: () =>
          setVisibleColumns((prev) => ({
            ...prev,
            [key]: !prev[key],
          })),
      })),
    [visibleColumns],
  );

  const allColumns = useMemo<MRT_ColumnDef<InvoiceFilterRow>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 70,
        enableSorting: false,
        Cell: ({ row }) => row.original?.sno ?? index + row.index + 1,
      },
      {
        accessorKey: "bill_to_name",
        header: "Party name",
        size: 200,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Party name"
            value={appliedFilters.bill_to}
            displayValue={appliedFilters.party_display ?? appliedFilters.bill_to}
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "bill_to_name"}
            onStartEdit={() => openHeaderEditor("bill_to_name")}
            onStopEdit={() => collapseHeaderEditor("bill_to_name")}
            renderEditor={({ autoFocus, onClose }) => (
              <SearchableSelect
                autoFocus={autoFocus}
                placeholder="Search customer"
                apiEndpoint={URL.customer}
                searchFields={["customer_name", "customer_code"]}
                displayFormat={(item: Record<string, unknown>) => ({
                  value: String(item.customer_code ?? item.code ?? ""),
                  label: String(item.customer_name ?? item.name ?? ""),
                })}
                value={appliedFilters.bill_to || null}
                displayValue={appliedFilters.party_display}
                onChange={(value, selectedData) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    bill_to: value ?? "",
                    party_display: selectedData?.label ?? null,
                  }));
                  if (value) onClose();
                }}
                minSearchLength={2}
                dropdownZIndex={1000}
                size="xs"
                styles={formTextFilterStyles}
              />
            )}
          />
        ),
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatCell(cell.getValue())}
          </Text>
        ),
      },
      {
        accessorKey: "document_no",
        header: "Document No",
        size: 180,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Document No"
            value={appliedFilters.document_no}
            displayValue={appliedFilters.document_no}
            theme={erpTheme}
            placeholder="Filter Document No"
            isEditing={editingHeaderId === "document_no"}
            onStartEdit={() => openHeaderEditor("document_no")}
            onStopEdit={() => collapseHeaderEditor("document_no")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, document_no: next }))
            }
          />
        ),
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatCell(cell.getValue())}
          </Text>
        ),
      },
      {
        accessorKey: "document_date",
        header: "Document date",
        size: 140,
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatCell(cell.getValue())}
          </Text>
        ),
      },
      {
        accessorKey: "shipment_no",
        header: "Shipment No",
        size: 180,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Shipment No"
            value={appliedFilters.shipment_no}
            displayValue={appliedFilters.shipment_no}
            theme={erpTheme}
            placeholder="Filter Shipment No"
            isEditing={editingHeaderId === "shipment_no"}
            onStartEdit={() => openHeaderEditor("shipment_no")}
            onStopEdit={() => collapseHeaderEditor("shipment_no")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, shipment_no: next }))
            }
          />
        ),
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatCell(cell.getValue())}
          </Text>
        ),
      },
      {
        accessorKey: "gstn",
        header: "GSTN",
        size: 140,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="GSTN"
            value={appliedFilters.gstn}
            displayValue={appliedFilters.gstn}
            theme={erpTheme}
            placeholder="Filter GSTN"
            isEditing={editingHeaderId === "gstn"}
            onStartEdit={() => openHeaderEditor("gstn")}
            onStopEdit={() => collapseHeaderEditor("gstn")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, gstn: next }))
            }
          />
        ),
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatCell(cell.getValue())}
          </Text>
        ),
      },
      {
        accessorKey: "state_name",
        header: "State",
        size: 160,
        Header: () => {
          const matched = stateOptions.find(
            (o) => o.value === appliedFilters.state_id,
          );
          return (
            <ERPListColumnHeaderFilter
              label="State"
              value={appliedFilters.state_id}
              displayValue={
                appliedFilters.state_name ||
                matched?.label ||
                appliedFilters.state_id
              }
              onChange={() => {}}
              theme={erpTheme}
              isEditing={editingHeaderId === "state_name"}
              onStartEdit={() => openHeaderEditor("state_name")}
              onStopEdit={() => collapseHeaderEditor("state_name")}
              renderEditor={({ autoFocus, onClose }) => (
                <Select
                  autoFocus={autoFocus}
                  placeholder="Select state"
                  searchable
                  clearable
                  size="xs"
                  data={stateOptions}
                  value={appliedFilters.state_id || null}
                  onChange={(value) => {
                    const matchedOption = stateOptions.find(
                      (o) => o.value === value,
                    );
                    commitHeaderFilters((prev) => ({
                      ...prev,
                      state_id: value ?? "",
                      state_name: matchedOption?.label ?? "",
                    }));
                    if (value) onClose();
                  }}
                  comboboxProps={{ zIndex: 1000 }}
                  classNames={erpListGeistSelectClassNames}
                  styles={filterFieldStyles}
                />
              )}
            />
          );
        },
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {formatCell(cell.getValue())}
          </Text>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableSorting: false,
        Cell: ({ row }) => {
          const id = rowInvoiceId(row.original);
          if (!id) {
            return (
              <Text size="xs" c="dimmed" style={{ fontFamily: erpTheme.fontSans }}>
                —
              </Text>
            );
          }
          const status = String(row.original?.status ?? "").toUpperCase();
          const canEdit = status === "" || status === "UNPOSTED";
          const basePath = isCreditNoteRow(row.original)
            ? "/credit-note"
            : "/invoice";
          return (
            <Menu
              withinPortal
              position="bottom-end"
              shadow="md"
              width={200}
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
                      navigate(`${basePath}/view/${id}`);
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
                {canEdit && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      onClick={() => {
                        setStoreFilters(LIST_KEY, appliedFilters);
                        setStoreSearch(LIST_KEY, search);
                        setShouldRestore(LIST_KEY, true);
                        navigate(`${basePath}/edit/${id}`);
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
              </Menu.Dropdown>
            </Menu>
          );
        },
      },
    ],
    [
      erpTheme,
      index,
      navigate,
      primary,
      appliedFilters,
      editingHeaderId,
      openHeaderEditor,
      collapseHeaderEditor,
      commitHeaderFilters,
      filterFieldStyles,
      formTextFilterStyles,
      stateOptions,
      search,
      setStoreFilters,
      setStoreSearch,
      setShouldRestore,
    ],
  );

  const columns = useMemo(
    () =>
      allColumns.filter((col) => {
        const id = columnId(col);
        if (id === "actions") return true;
        return visibleColumns[id as ColumnKey] !== false;
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
    data: loading ? [] : tableData,
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
        {loading ? (
          <Stack align="center" gap="md">
            <Loader size="lg" color={primary} />
            <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
              Loading invoices…
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            No invoices found
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
      const extraStyles =
        column.id === "actions"
          ? {
              // Pinned-right Actions cell. `minWidth: 80px` matches the
              // head cell so the sticky body cell and sticky head cell
              // stay the same width. `zIndex: 2` stays BELOW the sticky
              // head (`zIndex: 4`) so the head paints over the body cell
              // at the bottom-right corner during horizontal scroll.
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
      const extraStyles =
        column.id === "actions"
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
           * and the inline filter editor never resizes the row.
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
                  value={totalRecords}
                  label="Unposted"
                />
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconClock size={14} color="#d97706" />}
                  iconBackground="#fef3c7"
                  iconColor="#d97706"
                  value={tableData.length}
                  label="On page"
                />
              </>
            ),
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
                  onClick={() => {
                    setShowFilters((s) => {
                      const opening = !s;
                      if (opening) setDraftFilters({ ...appliedFilters });
                      return opening;
                    });
                  }}
                >
                  {showFilters ? "Hide filters" : "Filters"}
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  styles={erpToolbarOutlineButtonStyles(erpTheme)}
                  onClick={() => {
                    setSearch("");
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                >
                  Reset search
                </Button>
              </>
            ),
          }}
          filters={{
            opened: showFilters,
            title: "Filters",
            subtitle: "Party name, document no., shipment no., state",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={erpTheme}
                onClear={clearAllFilters}
                onApply={applyFilters}
                applyLoading={loading}
                applyDisabled={loading}
              />
            ),
            children: (
              <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      label="Party name"
                      placeholder="Search customer"
                      apiEndpoint={URL.customer}
                      searchFields={["customer_name", "customer_code"]}
                      displayFormat={(item: Record<string, unknown>) => ({
                        value: String(item.customer_code ?? item.code ?? ""),
                        label: String(item.customer_name ?? item.name ?? ""),
                      })}
                      value={draftFilters.bill_to || null}
                      displayValue={draftFilters.party_display}
                      onChange={(value, selectedData) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          bill_to: value ?? "",
                          party_display: selectedData?.label ?? null,
                        }));
                      }}
                      minSearchLength={2}
                      dropdownZIndex={1000}
                      size="xs"
                      styles={formTextFilterStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Document No"
                      placeholder="Enter document no."
                      value={draftFilters.document_no}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          document_no: e.currentTarget.value,
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
                      label="Shipment No"
                      placeholder="Enter shipment no."
                      value={draftFilters.shipment_no}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          shipment_no: e.currentTarget.value,
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
                    <Dropdown
                      label="State"
                      placeholder="Select state"
                      data={stateOptions}
                      value={
                        draftFilters.state_id ? draftFilters.state_id : null
                      }
                      onChange={(value) => {
                        const matchedOption = stateOptions.find(
                          (o) => o.value === value,
                        );
                        setDraftFilters((prev) => ({
                          ...prev,
                          state_id: value ?? "",
                          state_name: matchedOption?.label ?? "",
                        }));
                      }}
                      searchable
                      size="xs"
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="GSTN"
                      placeholder="Enter GSTN"
                      value={draftFilters.gstn}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          gstn: e.currentTarget.value,
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
                      label="Document Date From"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.document_date_from}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          document_date_from: date,
                        }))
                      }
                      size="xs"
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: {
                          ...filterFieldStyles.input,
                          minHeight: 32,
                        },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Document Date To"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.document_date_to}
                      onChange={(date) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          document_date_to: date,
                        }))
                      }
                      size="xs"
                      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: {
                          ...filterFieldStyles.input,
                          minHeight: 32,
                        },
                      }}
                    />
                  </Box>
                </Grid.Col>
              </Grid>
            ),
          }}
          table={{
            footer: (
              <Box px="md" py={0} style={{ borderTop: `1px solid ${border}`, backgroundColor: cardBg }}>
                <PaginationBar
                  pageSize={pagination.pageSize}
                  currentPage={pagination.pageIndex + 1}
                  totalRecords={totalRecords}
                  onPageSizeChange={handlePageSizeChange}
                  onPageChange={(page) =>
                    setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))
                  }
                  pageSizeOptions={["10", "25", "50"]}
                />
              </Box>
            ),
            children: listError ? (
              <Center py="xl" style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}>
                <Text size="sm" c="dimmed" style={{ fontFamily: erpTheme.fontSans }}>
                  Error loading invoices. Please try refreshing the page.
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
