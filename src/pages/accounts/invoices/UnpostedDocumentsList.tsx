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
  IconDots,
  IconEdit,
  IconEye,
  IconFiles,
  IconFilter,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useLocation, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
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
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { postAPICall } from "../../../service/postApiCall";
import { API_HEADER } from "../../../store/storeKeys";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import useDateFormat from "../../../hooks/useDateFormat";
import { useListFilterStore } from "../../../store/listFilterStore";
import {
  type FinanceDocumentListRow,
  openFinanceDocument,
} from "./financeDocumentNavigation";
import { JobInvoiceDeleteConfirmModal } from "../../../components/JobInvoiceDeleteConfirmModal";
import { ToastNotification } from "../../../components";
import { deactivateInvoice } from "../../../utils/deactivateInvoice";
import { deactivateReverseInvoice } from "../../../utils/deactivateReverseInvoice";

type UnpostedDeleteTarget =
  | { kind: "invoice"; id: number }
  | { kind: "reverse"; id: number };

const LIST_KEY = "UNPOSTED_DOCUMENTS_LIST";

type FinanceDocumentsFilterResponse = {
  index?: number;
  limit?: number | null;
  total?: number;
  data?: FinanceDocumentListRow[];
};

type FinanceListQueryResult = {
  data: FinanceDocumentListRow[];
};

type UnpostedListFilters = {
  /** Sent to API as `filters.customer_name` (party display name). */
  customer_name: string;
  customer_display: string | null;
  customer_code: string | null;
  document_no: string;
  /** Day book document type code (e.g. GLJ); sent as `filters.daybook_type`. */
  daybook_type: string | null;
  document_date_from: Date | null;
  document_date_to: Date | null;
};

const EMPTY_UNPOSTED_FILTERS: UnpostedListFilters = {
  customer_name: "",
  customer_display: null,
  customer_code: null,
  document_no: "",
  daybook_type: null,
  document_date_from: null,
  document_date_to: null,
};

function restoreUnpostedFilters(
  raw: Record<string, unknown>,
): UnpostedListFilters {
  return {
    ...EMPTY_UNPOSTED_FILTERS,
    customer_name: String(raw.customer_name ?? ""),
    customer_display:
      raw.customer_display != null && raw.customer_display !== ""
        ? String(raw.customer_display)
        : null,
    customer_code:
      raw.customer_code != null && raw.customer_code !== ""
        ? String(raw.customer_code)
        : null,
    document_no: String(raw.document_no ?? ""),
    daybook_type:
      raw.daybook_type != null && raw.daybook_type !== ""
        ? String(raw.daybook_type)
        : null,
    document_date_from: raw.document_date_from
      ? new Date(String(raw.document_date_from))
      : null,
    document_date_to: raw.document_date_to
      ? new Date(String(raw.document_date_to))
      : null,
  };
}

const columnLabels = {
  sno: "S.No",
  record_type: "Type",
  customer_name: "Customer / party",
  daybook_type: "Daybook",
  document_no: "Document No",
  document_date: "Document date",
} as const;

type ColumnKey = keyof typeof columnLabels;

const columnDefault: Record<ColumnKey, boolean> = {
  sno: true,
  record_type: false,
  customer_name: true,
  daybook_type: true,
  document_no: true,
  document_date: true,
};

function columnId<T extends Record<string, unknown>>(
  col: MRT_ColumnDef<T>,
): string {
  if (col.id) return col.id;
  if ("accessorKey" in col && col.accessorKey) return String(col.accessorKey);
  return "";
}

function formatCell(value: unknown): string {
  if (value == null || value === "") return "-";
  return String(value);
}

function humanizeRecordType(recordType: string): string {
  const t = recordType.trim();
  if (!t) return "-";
  return t
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function UnpostedDocumentsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);
  const [isRestoring, setIsRestoring] = useState(true);

  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearAllStore = useListFilterStore((s) => s.clearAll);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);
  const dateFormat = useDateFormat();
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);
  const openHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId(id);
  }, []);
  const collapseHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId((cur) => (cur === id ? null : cur));
  }, []);

  const commitHeaderFilters = useCallback(
    (updater: (prev: UnpostedListFilters) => UnpostedListFilters) => {
      setAppliedFilters((prev) => {
        const next = updater(prev);
        setDraftFilters(next);
        setStoreFilters(LIST_KEY, next);
        return next;
      });
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    [setStoreFilters],
  );

  const formatFilterDateLabel = useCallback(
    (value: Date | null) => {
      if (!value) return "";
      return dayjs(value).format(dateFormat);
    },
    [dateFormat],
  );
  const [visibleColumns, setVisibleColumns] = useState<
    Record<ColumnKey, boolean>
  >(() => ({ ...columnDefault }));
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<UnpostedListFilters>({
    ...EMPTY_UNPOSTED_FILTERS,
  });
  const [appliedFilters, setAppliedFilters] = useState<UnpostedListFilters>({
    ...EMPTY_UNPOSTED_FILTERS,
  });
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UnpostedDeleteTarget | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const cancelDelete = useCallback(() => {
    if (deletingId != null) return;
    setPendingDelete(null);
  }, [deletingId]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setDeletingId(target.id);
    try {
      if (target.kind === "reverse") {
        await deactivateReverseInvoice(target.id, API_HEADER);
      } else {
        await deactivateInvoice(target.id, API_HEADER);
      }
      ToastNotification({
        type: "success",
        message:
          target.kind === "reverse"
            ? "Reverse invoice deleted successfully"
            : "Invoice deleted successfully",
      });
      setPendingDelete(null);
      await queryClient.invalidateQueries({
        queryKey: ["finance-unposted-documents"],
      });
    } catch {
      ToastNotification({
        type: "error",
        message:
          target.kind === "reverse"
            ? "Failed to delete reverse invoice. Please try again."
            : "Failed to delete invoice. Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  }, [pendingDelete, queryClient]);

  const appliedFiltersKey = useMemo(
    () =>
      JSON.stringify({
        customer_name: appliedFilters.customer_name,
        customer_code: appliedFilters.customer_code ?? "",
        document_no: appliedFilters.document_no,
        daybook_type: appliedFilters.daybook_type ?? "",
        document_date_from:
          appliedFilters.document_date_from?.toISOString() ?? "",
        document_date_to: appliedFilters.document_date_to?.toISOString() ?? "",
      }),
    [appliedFilters],
  );

  const { data: daybookMasterRows = [] } = useQuery({
    queryKey: ["daybook-master", "unposted-documents-filter"],
    queryFn: async () => {
      const response = await postAPICall(
        URL.daybook,
        { filters: {} },
        API_HEADER,
      );
      return (response as { data?: unknown[] })?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const daybookFilterOptions = useMemo(() => {
    const rows = daybookMasterRows as {
      document_type?: string;
      daybook_type?: string;
      type?: string;
      name?: string;
      daybook_name?: string;
    }[];
    if (!Array.isArray(rows)) return [];
    const map = new Map<string, string>();
    for (const item of rows) {
      const typeVal = String(
        item.document_type ?? item.daybook_type ?? item.type ?? "",
      ).trim();
      if (!typeVal) continue;
      const displayName = String(item.name ?? item.daybook_name ?? "").trim();
      const label =
        displayName && displayName !== typeVal
          ? `${displayName} (${typeVal})`
          : typeVal;
      if (!map.has(typeVal)) map.set(typeVal, label);
    }
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [daybookMasterRows]);

  const index = pagination.pageIndex * pagination.pageSize;

  useEffect(() => {
    if (isRestoring) return;
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 },
    );
  }, [debouncedSearch, appliedFiltersKey, isRestoring]);

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
      const restored = restoreUnpostedFilters(
        stored.filters as Record<string, unknown>,
      );
      setDraftFilters(restored);
      setAppliedFilters(restored);
    }

    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllExcept(LIST_KEY);
    setShouldRestore(LIST_KEY, false);
    setIsRestoring(false);
  }, [location.key, getState, clearAllExcept, setShouldRestore]);

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters({ ...EMPTY_UNPOSTED_FILTERS });
    setAppliedFilters({ ...EMPTY_UNPOSTED_FILTERS });
    setEditingHeaderId(null);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearAllStore(LIST_KEY);
  };

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const buildListPayload = useCallback(
    (filtersState: UnpostedListFilters, searchValue: string) => {
      const filters: Record<string, string> = { status: "UNPOSTED" };
      if (searchValue.trim()) filters.search = searchValue.trim();
      if (filtersState.customer_name.trim()) {
        filters.customer_name = filtersState.customer_name.trim();
      }
      if (filtersState.document_date_from) {
        filters.document_date_from = dayjs(filtersState.document_date_from).format(
          "YYYY-MM-DD",
        );
      }
      if (filtersState.document_date_to) {
        filters.document_date_to = dayjs(filtersState.document_date_to).format(
          "YYYY-MM-DD",
        );
      }
      if (filtersState.document_no.trim()) {
        filters.document_no = filtersState.document_no.trim();
      }
      if (filtersState.daybook_type?.trim()) {
        filters.daybook_type = filtersState.daybook_type.trim();
      }
      return { filters };
    },
    [],
  );

  const {
    data: listResult,
    isFetching,
    error: listError,
  } = useQuery<FinanceListQueryResult>({
    queryKey: [
      "finance-unposted-documents",
      pagination.pageIndex,
      pagination.pageSize,
      debouncedSearch,
      appliedFiltersKey,
    ],
    queryFn: async (): Promise<FinanceListQueryResult> => {
      try {
        const payload = buildListPayload(appliedFilters, debouncedSearch);
        const response = (await apiCallProtected.post(
          `${URL.financeDocumentsFilter}?index=${index}&limit=${pagination.pageSize}`,
          payload,
        )) as Record<string, unknown>;

        const raw = response as { data?: unknown };
        const bodyCandidate =
          raw?.data != null && !Array.isArray(raw.data) ? raw.data : raw;
        const body =
          bodyCandidate != null
            ? (bodyCandidate as
                | FinanceDocumentsFilterResponse
                | FinanceDocumentListRow[])
            : null;

        if (!body) {
          setTotalRecords(0);
          return { data: [] };
        }

        const list = Array.isArray(
          (body as FinanceDocumentsFilterResponse).data,
        )
          ? ((body as FinanceDocumentsFilterResponse)
              .data as FinanceDocumentListRow[])
          : Array.isArray(body)
            ? (body as FinanceDocumentListRow[])
            : [];

        const totalEnvelope =
          body != null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          ("total" in body || "index" in body)
            ? (body as unknown as Record<string, unknown>)
            : (raw as Record<string, unknown>);
        const listTotal = getBookingShipmentFilterListTotal(
          totalEnvelope,
          list,
          index,
        );
        setTotalRecords(listTotal);
        return { data: list };
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 404) {
          setTotalRecords(0);
          return { data: [] };
        }
        throw err;
      }
    },
    // Fetch whenever filters/pagination change; search is debounced via queryKey only.
    enabled: !isRestoring,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: "always",
    placeholderData: undefined,
  });

  const tableData = listResult?.data ?? [];

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(totalRecords / pagination.pageSize),
    );
    const maxPageIndex = totalPages - 1;
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((p) => ({ ...p, pageIndex: maxPageIndex }));
    }
  }, [totalRecords, pagination.pageSize, pagination.pageIndex]);

  const loading = isFetching;

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

  const allColumns = useMemo<MRT_ColumnDef<FinanceDocumentListRow>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        size: 70,
        enableSorting: false,
        Cell: ({ row }) => row.original?.sno ?? index + row.index + 1,
      },
      {
        accessorKey: "record_type",
        header: "Type",
        size: 160,
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {humanizeRecordType(String(cell.getValue() ?? ""))}
          </Text>
        ),
      },
      {
        accessorKey: "customer_name",
        header: "Customer / party",
        size: 320,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Customer / party"
            value={appliedFilters.customer_name}
            displayValue={appliedFilters.customer_name}
            theme={erpTheme}
            placeholder="Filter customer"
            isEditing={editingHeaderId === "customer_name"}
            onStartEdit={() => openHeaderEditor("customer_name")}
            onStopEdit={() => collapseHeaderEditor("customer_name")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({
                ...prev,
                customer_name: next,
                customer_code: null,
                customer_display: null,
              }))
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
        accessorKey: "daybook_type",
        header: "Daybook",
        size: 160,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Daybook"
            value={appliedFilters.daybook_type ?? ""}
            displayValue={
              daybookFilterOptions.find((o) => o.value === appliedFilters.daybook_type)?.label ??
              appliedFilters.daybook_type ??
              ""
            }
            onChange={() => {}}
            theme={erpTheme}
            isEditing={editingHeaderId === "daybook_type"}
            onStartEdit={() => openHeaderEditor("daybook_type")}
            onStopEdit={() => collapseHeaderEditor("daybook_type")}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                placeholder="All daybooks"
                clearable
                searchable
                size="xs"
                data={daybookFilterOptions}
                value={appliedFilters.daybook_type}
                onChange={(value) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    daybook_type: value,
                  }));
                  if (value) onClose();
                }}
                comboboxProps={{ zIndex: 1000 }}
                classNames={{
                  dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                  input: ERP_LIST_GEIST_ROOT_CLASS,
                }}
                styles={filterFieldStyles}
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
            placeholder="Filter document no"
            isEditing={editingHeaderId === "document_no"}
            onStartEdit={() => openHeaderEditor("document_no")}
            onStopEdit={() => collapseHeaderEditor("document_no")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({
                ...prev,
                document_no: next,
              }))
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
        Header: () => {
          const from = appliedFilters.document_date_from;
          const to = appliedFilters.document_date_to;
          const dateFilterDisplay =
            from && to && !dayjs(from).isSame(to, "day")
              ? `${formatFilterDateLabel(from)} – ${formatFilterDateLabel(to)}`
              : formatFilterDateLabel(from ?? to);
          return (
            <ERPListColumnHeaderFilter
              label="Document date"
              value={from ? dayjs(from).format("YYYY-MM-DD") : ""}
              displayValue={dateFilterDisplay}
              onChange={() => {}}
              theme={erpTheme}
              isEditing={editingHeaderId === "document_date"}
              onStartEdit={() => openHeaderEditor("document_date")}
              onStopEdit={() => collapseHeaderEditor("document_date")}
              renderEditor={({ autoFocus, onClose }) => (
                <SingleDateInput
                  size="xs"
                  value={from}
                  onChange={(date) => {
                    commitHeaderFilters((prev) => ({
                      ...prev,
                      document_date_from: date,
                      document_date_to: date ?? prev.document_date_to,
                    }));
                    if (date) onClose();
                  }}
                  classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
                  styles={filterFieldStyles}
                  {...(autoFocus ? { autoFocus: true } : {})}
                />
              )}
            />
          );
        },
        Cell: ({ cell }) => (
          <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            {dayjs(formatCell(cell.getValue())).format(dateFormat)}
          </Text>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableSorting: false,
        Cell: ({ row }) => {
          const r = row.original;
          const id = r.id;
          const key = `${r.record_type}-${id}`;
          const busy = openingKey === key;
          if (id == null) {
            return (
              <Text
                size="xs"
                c="dimmed"
                style={{ fontFamily: erpTheme.fontSans }}
              >
                —
              </Text>
            );
          }
          const status = String(r.status ?? "").toUpperCase();
          const canEdit = status === "" || status === "UNPOSTED";
          const recordType = String(r.record_type ?? "")
            .trim()
            .toLowerCase();
          const canDelete =
            canEdit &&
            (recordType === "invoice" || recordType === "reverse_invoice");

          const run = async (mode: "edit" | "view") => {
            setStoreFilters(LIST_KEY, appliedFilters);
            setStoreSearch(LIST_KEY, search);
            setShouldRestore(LIST_KEY, true);
            setOpeningKey(key);
            try {
              await openFinanceDocument(navigate, r, mode, {
                returnTo: "/unposted-documents",
              });
            } finally {
              setOpeningKey(null);
            }
          };

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
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  loading={busy}
                >
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px={10} py={5}>
                  <UnstyledButton onClick={() => void run("view")}>
                    <Group gap="sm">
                      <IconEye size={16} color={primary} />
                      <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
                        View
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Box>
                {canEdit && (
                  <Box px={10} py={5}>
                    <UnstyledButton onClick={() => void run("edit")}>
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
                {canDelete && (
                  <Box px={10} py={5}>
                    <UnstyledButton
                      disabled={deletingId === id}
                      onClick={() =>
                        setPendingDelete({
                          kind:
                            recordType === "reverse_invoice"
                              ? "reverse"
                              : "invoice",
                          id: Number(id),
                        })
                      }
                    >
                      <Group gap="sm">
                        <IconTrash size={16} color="#C92A2A" />
                        <Text
                          size="sm"
                          style={{ fontFamily: erpTheme.fontSans }}
                        >
                          Delete
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
      appliedFilters,
      commitHeaderFilters,
      collapseHeaderEditor,
      daybookFilterOptions,
      deletingId,
      editingHeaderId,
      erpTheme,
      filterFieldStyles,
      formatFilterDateLabel,
      index,
      navigate,
      openHeaderEditor,
      openingKey,
      primary,
      search,
      setShouldRestore,
      setStoreFilters,
      setStoreSearch,
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
              Loading unposted documents…
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            No unposted documents found
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
          width: colSize,
          minWidth: colSize,
          padding: "8px 16px",
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: erpTheme.headerBg,
          borderBottom: `1px solid ${border}`,
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
        style={{
          ...erpListGeistRootTypography,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {openingKey != null && (
          <Box
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 20000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255, 255, 255, 0.85)",
            }}
          >
            <Stack align="center" gap="md">
              <Loader size="lg" color="#105476" />
              <Text
                size="sm"
                fw={500}
                c="#105476"
                style={{ fontFamily: erpTheme.fontSans }}
              >
                Opening document…
              </Text>
            </Stack>
          </Box>
        )}
        <ERPListScreen
          theme={erpTheme}
          className={ERP_LIST_GEIST_ROOT_CLASS}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconFiles size={14} color={primary} />}
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
            subtitle: "Customer, document no, daybook, document date range",
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
                    <TextInput
                      label="Document no"
                      placeholder="e.g. JV-2605-0078"
                      value={draftFilters.document_no}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          document_no: e.currentTarget.value,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={{
                        ...filterFieldStyles,
                        input: { ...filterFieldStyles.input, minHeight: 32 },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <Select
                      label="Daybook"
                      placeholder="All daybooks"
                      clearable
                      searchable
                      data={daybookFilterOptions}
                      value={draftFilters.daybook_type}
                      onChange={(v) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          daybook_type: v,
                        }))
                      }
                      size="xs"
                      classNames={{
                        dropdown: ERP_LIST_GEIST_ROOT_CLASS,
                        input: ERP_LIST_GEIST_ROOT_CLASS,
                      }}
                      styles={{
                        ...filterFieldStyles,
                        input: { ...filterFieldStyles.input, minHeight: 32 },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <TextInput
                      label="Customer name"
                      placeholder="Customer / party name"
                      value={draftFilters.customer_name}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          customer_name: e.currentTarget.value,
                          customer_code: null,
                          customer_display: null,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
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
                      label="Document date from"
                      // placeholder="YYYY-MM-DD"
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
                        input: { ...filterFieldStyles.input, minHeight: 32 },
                      }}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Document date to"
                      // placeholder="YYYY-MM-DD"
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
                        input: { ...filterFieldStyles.input, minHeight: 32 },
                      }}
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
            children: listError ? (
              <Center
                py="xl"
                style={{ backgroundColor: cardBg, flex: 1, minHeight: 200 }}
              >
                <Text
                  size="sm"
                  c="dimmed"
                  style={{ fontFamily: erpTheme.fontSans }}
                >
                  Error loading unposted documents. Please try refreshing the
                  page.
                </Text>
              </Center>
            ) : (
              <MantineReactTable table={table} />
            ),
          }}
        />
        <JobInvoiceDeleteConfirmModal
          opened={pendingDelete != null}
          loading={deletingId != null}
          title={
            pendingDelete?.kind === "reverse"
              ? "Delete reverse invoice"
              : "Delete invoice"
          }
          message={
            pendingDelete?.kind === "reverse"
              ? "Are you sure you want to delete this reverse invoice? This action cannot be undone."
              : "Are you sure you want to delete this invoice? This action cannot be undone."
          }
          onClose={cancelDelete}
          onConfirm={() => void confirmDelete()}
        />
      </Box>
    </MantineProvider>
  );
}
