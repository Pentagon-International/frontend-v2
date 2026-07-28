import { useCallback, useMemo, useState, useEffect } from "react";
import useAuthStore from "../../../store/authStore";
import {
  bindMoneyWholeNumberMode,
  formatMoneyAmountBound,
  isVietnamBranchFromUser,
} from "../../../utils/nonDecimalMoneyAmount";
import { useNavigate } from "react-router-dom";
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
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconClock,
  IconCircleCheck,
  IconDots,
  IconEdit,
  IconEye,
  IconFileInvoice,
  IconFilter,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import useDateFormat from "../../../hooks/useDateFormat";
import {
  Dropdown,
  ERPListColumnHeaderFilter,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
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
  erpToolbarPrimaryButtonStyles,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { apiCallProtected } from "../../../api/axios";
import { useQuery } from "@tanstack/react-query";
import { URL } from "../../../api/serverUrls";
import FormTextInput from "../../../components/FormTextInput";
import { useListFilterStore } from "../../../store/listFilterStore";
import {
  MantineReactTable,
  type MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";

type NoteRow = Record<string, unknown> & {
  id?: number | string;
  sno?: number;
  note_no?: string;
  note_type?: string;
  document_date?: string;
  party_name?: string;
  status?: string;
  currency?: string;
  amount?: number | string;
  [key: string]: unknown;
};

type NoteFilterResponse = {
  status?: boolean;
  message?: string;
  index?: number;
  limit?: number;
  total?: number;
  data?: NoteRow[];
};

type Filters = {
  party_name: string;
  document_no: string;
  document_type: string;
  document_date: Date | null;
  date_from: Date | null;
  date_to: Date | null;
  status: "" | "POSTED" | "UNPOSTED";
};
const LIST_KEY = "DEBIT_CREDIT_NOTE_NON_TRADE_MASTER";

/** Column toggle labels (mirrors ReceiptMaster's `columnLabels`). */
const columnLabels = {
  sno: "S.No",
  document_no: "Document No",
  document_type: "Document Type",
  document_date: "Document Date",
  party_name: "Party Name",
  status: "Status",
  amount: "Amount",
} as const;
type ColumnKey = keyof typeof columnLabels;
const columnDefault: Record<ColumnKey, boolean> = {
  sno: true,
  document_no: true,
  document_type: true,
  document_date: true,
  party_name: true,
  status: true,
  amount: true,
};

export default function DebitCreditNoteNonTradeMaster() {
  const user = useAuthStore((s) => s.user);
  const dateFormat = useDateFormat();
  const isVietnamBranch = useMemo(() => isVietnamBranchFromUser(user), [user]);
  bindMoneyWholeNumberMode(isVietnamBranch);
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [paginationPageSize, setPaginationPageSize] = useState(25);
  const [paginationCurrentPage, setPaginationCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 1000);

  const [draftFilters, setDraftFilters] = useState<Filters>({
    party_name: "",
    document_no: "",
    document_type: "",
    document_date: null,
    status: "",
    date_from: dayjs().startOf("month").toDate(),
    date_to: dayjs().toDate(),
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>(draftFilters);

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
  const getState = useListFilterStore((s) => s.getState);
  const setStoreFilters = useListFilterStore((s) => s.setFilters);
  const setStoreSearch = useListFilterStore((s) => s.setSearch);
  const clearStoreFilters = useListFilterStore((s) => s.clearFilters);
  const clearStoreSearch = useListFilterStore((s) => s.clearSearch);
  const clearAllExcept = useListFilterStore((s) => s.clearAllExcept);
  const setShouldRestore = useListFilterStore((s) => s.setShouldRestore);

  const index = (paginationCurrentPage - 1) * paginationPageSize;
  const buildFiltersPayload = useMemo(() => {
    const payload: Record<string, string> = {};
    if (appliedFilters.party_name.trim())
      payload.party_name = appliedFilters.party_name.trim();
    if (appliedFilters.document_no.trim())
      payload.document_no = appliedFilters.document_no.trim();
    if (appliedFilters.document_type.trim())
      payload.document_type = appliedFilters.document_type.trim();
    if (appliedFilters.document_date)
      payload.document_date = dayjs(appliedFilters.document_date).format("YYYY-MM-DD");
    if (appliedFilters.date_from)
      payload.date_from = dayjs(appliedFilters.date_from).format("YYYY-MM-DD");
    if (appliedFilters.date_to)
      payload.date_to = dayjs(appliedFilters.date_to).format("YYYY-MM-DD");
    if (appliedFilters.status) payload.status = appliedFilters.status;
    if (debouncedSearch.trim()) payload.search = debouncedSearch.trim();
    return payload;
  }, [appliedFilters, debouncedSearch]);

  const {
    data: listData = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "debitCreditNoteNonTradeList",
      paginationCurrentPage,
      paginationPageSize,
      JSON.stringify(buildFiltersPayload),
    ],
    queryFn: async (): Promise<NoteRow[]> => {
      const payload = {
        filters: {
          ...(Object.keys(buildFiltersPayload).length > 0 ? buildFiltersPayload : {}),
          type: "non_trade",
        },
      };
      const res = (await apiCallProtected.post(
        `${URL.debitCreditNoteFilter}?index=${index}&limit=${paginationPageSize}`,
        payload,
      )) as NoteFilterResponse;

      const rows = Array.isArray(res?.data) ? res.data : [];
      const total = res?.total != null ? Number(res.total) : rows.length;
      setTotalRecords(total);
      return rows;
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (
      paginationCurrentPage !== 1 &&
      index >= totalRecords &&
      totalRecords > 0
    ) {
      setPaginationCurrentPage(1);
    }
  }, [index, paginationCurrentPage, totalRecords]);

  /**
   * Header-filter writes update BOTH draft and applied state at once
   * (instant filtering, mirroring the EnquiryMaster column-header UX). This
   * keeps the advanced filter section visually in sync, resets pagination to
   * page 1, and persists the new filter to the global list-filter store so
   * the value is preserved when navigating back from associated pages.
   */
  const commitHeaderFilters = useCallback(
    (updater: (prev: Filters) => Filters) => {
      setDraftFilters((prev) => {
        const next = updater(prev);
        setAppliedFilters(next);
        setStoreFilters(LIST_KEY, next);
        return next;
      });
      setPaginationCurrentPage(1);
    },
    [setStoreFilters],
  );

  /*
   * Shared ERP list theme (mirrors ReceiptMaster). Used both by the page
   * scaffold (ERPListScreen) and by column-header filter editors so the
   * collapsed header label inherits the same font-family as the rest of
   * the page.
   */
  const erpTheme = useMemo<ErpListTheme>(
    () => ({
      border: "#e2e8f0",
      muted: "#64748b",
      fg: "#0f172a",
      primary: "#105476",
      headerBg: "#f8fafc",
      pageBg: "#F0F4F8",
      cardBg: "#ffffff",
      fontSans: "'Geist', sans-serif",
    }),
    [],
  );
  const muted = erpTheme.muted;
  const primary = erpTheme.primary;
  const cardBg = erpTheme.cardBg;
  const border = erpTheme.border;
  const filterFieldStyles = useMemo(
    () => erpListFilterUnifiedMantineStyles(erpTheme),
    [erpTheme],
  );

  // Alias kept so the existing column definitions below continue to compile.
  const headerFilterTheme = erpTheme;
  const headerFilterFieldStyles = filterFieldStyles;

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    () => ({ ...columnDefault }),
  );

  const columnToggleItems = useMemo(
    () =>
      (Object.keys(columnLabels) as ColumnKey[]).map((key) => ({
        id: String(key),
        label: columnLabels[key],
        checked: visibleColumns[key],
        onToggle: () =>
          setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] })),
      })),
    [visibleColumns],
  );

  const columns = useMemo<MRT_ColumnDef<NoteRow>[]>(
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
        accessorKey: "document_no",
        header: "Document No",
        size: 160,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Document No"
            value={appliedFilters.document_no}
            displayValue={appliedFilters.document_no}
            theme={headerFilterTheme}
            placeholder="Filter Document No"
            isEditing={editingHeaderId === "document_no"}
            onStartEdit={() => openHeaderEditor("document_no")}
            onStopEdit={() => collapseHeaderEditor("document_no")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, document_no: next }))
            }
          />
        ),
      },
      {
        accessorKey: "document_type",
        header: "Document Type",
        size: 120,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Document Type"
            value={appliedFilters.document_type}
            displayValue={appliedFilters.document_type}
            theme={headerFilterTheme}
            placeholder="Filter Document Type"
            isEditing={editingHeaderId === "document_type"}
            onStartEdit={() => openHeaderEditor("document_type")}
            onStopEdit={() => collapseHeaderEditor("document_type")}
            onChange={(next) =>
              commitHeaderFilters((prev) => ({ ...prev, document_type: next }))
            }
          />
        ),
        Cell: ({ cell }) => {
          const v = cell.getValue<unknown>();
          return (
            <Text size="sm">{v == null ? "-" : String(v).toUpperCase()}</Text>
          );
        },
      },
      {
        accessorKey: "document_date",
        header: "Document Date",
        size: 140,
        Cell: ({ cell }) => {
          const v = cell.getValue<string | undefined>();
          return (
            <Text size="sm">
              {v ? dayjs(String(v)).format(dateFormat) : "-"}
            </Text>
          );
        },
      },
      {
        accessorKey: "party_name",
        header: "Party Name",
        size: 200,
        Header: () => (
          <ERPListColumnHeaderFilter
            label="Party Name"
            value={appliedFilters.party_name}
            displayValue={appliedFilters.party_name}
            onChange={() => {}}
            theme={headerFilterTheme}
            isEditing={editingHeaderId === "party_name"}
            onStartEdit={() => openHeaderEditor("party_name")}
            onStopEdit={() => collapseHeaderEditor("party_name")}
            renderEditor={({ autoFocus, onClose }) => (
              <SearchableSelect
                autoFocus={autoFocus}
                apiEndpoint={URL.customer}
                placeholder="Type party"
                value={appliedFilters.party_name || null}
                displayValue={appliedFilters.party_name || null}
                dropdownZIndex={1000}
                minSearchLength={1}
                searchFields={["customer_code", "customer_name", "name"]}
                returnOriginalData
                onChange={(_val, selected) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    party_name: selected?.label ?? "",
                  }));
                  if (selected) onClose();
                }}
                displayFormat={(item) => ({
                  value: String(item.customer_code ?? item.id ?? ""),
                  label: String(item.customer_name ?? item.name ?? "").trim(),
                })}
                size="xs"
                styles={headerFilterFieldStyles}
              />
            )}
          />
        ),
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
            theme={headerFilterTheme}
            isEditing={editingHeaderId === "status"}
            onStartEdit={() => openHeaderEditor("status")}
            onStopEdit={() => collapseHeaderEditor("status")}
            renderEditor={({ autoFocus, onClose }) => (
              <Select
                autoFocus={autoFocus}
                placeholder="Select status"
                searchable
                clearable
                size="xs"
                data={["POSTED", "UNPOSTED"]}
                value={appliedFilters.status || null}
                onChange={(value) => {
                  commitHeaderFilters((prev) => ({
                    ...prev,
                    status: (value as Filters["status"]) || "",
                  }));
                  if (value) onClose();
                }}
                comboboxProps={{ zIndex: 1000 }}
                classNames={erpListGeistSelectClassNames}
                styles={headerFilterFieldStyles}
              />
            )}
          />
        ),
        Cell: ({ cell }) => {
          const v = String(cell.getValue<unknown>() ?? "").toUpperCase();
          const isPosted = v === "POSTED";
          const isUnposted = v === "UNPOSTED";
          return (
            <Badge
              size="sm"
              variant="light"
              color={isPosted ? "green" : isUnposted ? "gray" : "blue"}
            >
              {v || "-"}
            </Badge>
          );
        },
      },
      {
        id: "amount",
        header: "Amount",
        size: 120,
        Cell: ({ cell }) => {
          const row = cell.row.original as NoteRow;
          const lines =
            (row?.debit_credit_note_tem as Array<Record<string, unknown>> | undefined) ??
            [];
          const total = (Array.isArray(lines) ? lines : []).reduce((sum, l) => {
            const v = (l as { amount?: unknown })?.amount;
            const n = typeof v === "number" ? v : Number(v);
            return Number.isFinite(n) ? sum + n : sum;
          }, 0);
          if (!Number.isFinite(total) || total === 0) return <Text size="sm">-</Text>;
          return (
            <Text size="sm">
              {formatMoneyAmountBound(total)}
            </Text>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 80,
        enableSorting: false,
        Cell: ({ row }) => {
          const statusUpper = String(row.original?.status ?? "").toUpperCase();
          const isUnposted = statusUpper === "UNPOSTED";
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
                      navigate(
                        `/debit-credit-note-non-trade/view/${String(
                          row.original?.id ?? "",
                        )}`,
                        { state: { data: row.original } },
                      );
                    }}
                  >
                    <Group gap="sm">
                      <IconEye size={16} color={primary} />
                      <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
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
                        navigate(
                          `/debit-credit-note-non-trade/edit/${String(
                            row.original?.id ?? "",
                          )}`,
                          { state: { data: row.original } },
                        );
                      }}
                    >
                      <Group gap="sm">
                        <IconEdit size={16} color={primary} />
                        <Text size="sm" style={{ fontFamily: erpTheme.fontSans }}>
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
      editingHeaderId,
      openHeaderEditor,
      collapseHeaderEditor,
      commitHeaderFilters,
      headerFilterTheme,
      headerFilterFieldStyles,
      erpTheme,
      primary,
      dateFormat,
    ],
  );

  /**
   * Apply the column-toggle visibility map. `actions` is always rendered.
   */
  const visibleMRTColumns = useMemo<MRT_ColumnDef<NoteRow>[]>(
    () =>
      columns.filter((col) => {
        const id =
          col.id ??
          ("accessorKey" in col && col.accessorKey
            ? String(col.accessorKey)
            : "");
        if (id === "actions") return true;
        return visibleColumns[id as ColumnKey] !== false;
      }),
    [columns, visibleColumns],
  );

  const table = useMantineReactTable({
    columns: visibleMRTColumns,
    /*
     * Pass empty rows while loading so MRT renders our
     * `renderEmptyRowsFallback` (the loader) inside `<tbody>`, keeping the
     * column-header filter row and the pagination footer mounted.
     */
    data: isLoading || isFetching ? [] : (listData ?? []),
    enableColumnFilters: false,
    enablePagination: true,
    enableTopToolbar: false,
    enableColumnActions: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableColumnPinning: true,
    enableStickyHeader: true,
    layoutMode: "grid",
    manualPagination: true,
    rowCount: totalRecords,
    state: {
      // We show our own overlay ("Refreshing data...") so disable MRT loaders
      // to prevent double-loader overlap on reload/back navigation.
      isLoading: false,
      showProgressBars: false,
    },
    initialState: {
      columnPinning: { right: ["actions"] },
    },
    enableRowNumbers: false,
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
    mantineTableContainerProps: {
      style: {
        height: "100%",
        flexGrow: 1,
        minHeight: 0,
        position: "relative",
        overflow: "auto",
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
          width: colSize,
          minWidth: colSize,
          padding: "8px 16px",
          fontSize: 14,
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
    renderEmptyRowsFallback: () => (
      <Center
        py={80}
        style={{ width: "100%", backgroundColor: cardBg }}
        className="erp-header-filter-fade"
      >
        {isLoading || isFetching ? (
          <Stack align="center" gap="md">
            <Loader size="lg" color={primary} />
            <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
              Loading debit/credit notes…
            </Text>
          </Stack>
        ) : (
          <Text c="dimmed" size="sm" style={{ fontFamily: erpTheme.fontSans }}>
            No records to display
          </Text>
        )}
      </Center>
    ),
  });

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setStoreFilters(LIST_KEY, draftFilters);
    setStoreSearch(LIST_KEY, search);
    setPaginationCurrentPage(1);
    setShowFilters(false);
  };

  const clearFilters = () => {
    const reset: Filters = {
      party_name: "",
      document_no: "",
      document_date: null,
      status: "",
      date_from: dayjs().startOf("month").toDate(),
      date_to: dayjs().toDate(),
    };
    setDraftFilters(reset);
    setAppliedFilters(reset);
    setSearch("");
    clearStoreFilters(LIST_KEY);
    clearStoreSearch(LIST_KEY);
    setPaginationCurrentPage(1);
    setShowFilters(false);
  };

  useEffect(() => {
    clearAllExcept(LIST_KEY);
    const stored = getState(LIST_KEY);
    if (stored?.shouldRestore) {
      const restoredFilters = (stored.filters as Filters | undefined) ?? null;
      if (restoredFilters) {
        setDraftFilters(restoredFilters);
        setAppliedFilters(restoredFilters);
      }
      if (typeof stored.search === "string") setSearch(stored.search);
      setShouldRestore(LIST_KEY, false);
    }
  }, []);

  /**
   * Compute lightweight summary stats from the current page rows. The
   * backend doesn't return `status_counts`, so we display Total (server-side
   * filtered total) + counts derived from the visible rows. Mirrors the
   * stat-pill block in ReceiptMaster.
   */
  const listStats = useMemo(() => {
    let posted = 0;
    let unposted = 0;
    for (const r of listData ?? []) {
      const s = String((r as NoteRow).status ?? "").toUpperCase();
      if (s === "POSTED") posted += 1;
      else if (s === "UNPOSTED") unposted += 1;
    }
    return { total: totalRecords, posted, unposted };
  }, [listData, totalRecords]);

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
        <ERPListScreen
          theme={erpTheme}
          className={ERP_LIST_GEIST_ROOT_CLASS}
          toolbar={{
            leading: (
              <>
                <ERPListStatPill
                  theme={erpTheme}
                  icon={<IconFileInvoice size={14} color={primary} />}
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
                  onClick={() =>
                    setShowFilters((s) => {
                      const opening = !s;
                      if (opening) setDraftFilters({ ...appliedFilters });
                      return opening;
                    })
                  }
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
                    navigate("/debit-credit-note-non-trade/create");
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
            subtitle: "Refine by party, document no., dates, or status",
            onClose: () => setShowFilters(false),
            footer: (
              <ERPListFilterActionsFooter
                theme={erpTheme}
                onClear={clearFilters}
                onApply={applyFilters}
                applyLoading={isLoading || isFetching}
                applyDisabled={isLoading || isFetching}
              />
            ),
            children: (
              <Grid gutter={{ base: "md", md: "lg" }} align="stretch">
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SearchableSelect
                      apiEndpoint={URL.customer}
                      label="Party Name"
                      placeholder="Type party"
                      value={draftFilters.party_name || null}
                      displayValue={draftFilters.party_name || null}
                      dropdownZIndex={1000}
                      minSearchLength={1}
                      searchFields={[
                        "customer_code",
                        "customer_name",
                        "name",
                      ]}
                      returnOriginalData
                      onChange={(_val, selected) =>
                        setDraftFilters((p) => ({
                          ...p,
                          party_name: selected?.label ?? "",
                        }))
                      }
                      displayFormat={(item) => ({
                        value: String(item.customer_code ?? item.id ?? ""),
                        label: String(
                          item.customer_name ?? item.name ?? "",
                        ).trim(),
                      })}
                      size="xs"
                      classNames={erpListGeistSelectClassNames}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Document No"
                      placeholder="Type document no"
                      value={draftFilters.document_no}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDraftFilters((p) => ({
                          ...p,
                          document_no: e.currentTarget.value,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <FormTextInput
                      label="Document Type"
                      placeholder="Type document type"
                      value={draftFilters.document_type}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setDraftFilters((p) => ({
                          ...p,
                          document_type: e.currentTarget.value,
                        }))
                      }
                      size="xs"
                      classNames={{ input: ERP_LIST_GEIST_ROOT_CLASS }}
                      styles={filterFieldStyles}
                    />
                  </Box>
                </Grid.Col>
                <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN}>
                  <Box style={erpListFilterFieldCellStyle}>
                    <SingleDateInput
                      label="Document Date"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.document_date}
                      onChange={(d) =>
                        setDraftFilters((p) => ({ ...p, document_date: d }))
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
                      label="Date From"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.date_from}
                      onChange={(d) =>
                        setDraftFilters((p) => ({ ...p, date_from: d }))
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
                      label="Date To"
                      placeholder="YYYY-MM-DD"
                      value={draftFilters.date_to}
                      onChange={(d) =>
                        setDraftFilters((p) => ({ ...p, date_to: d }))
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
                    <Dropdown
                      size="xs"
                      label="Status"
                      placeholder="Select Status"
                      data={["POSTED", "UNPOSTED"]}
                      searchable
                      value={draftFilters.status || null}
                      onChange={(value) =>
                        setDraftFilters((p) => ({
                          ...p,
                          status: (value as Filters["status"]) || "",
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
                pageIndex={paginationCurrentPage - 1}
                pageSize={paginationPageSize}
                onPageIndexChange={(idx) => setPaginationCurrentPage(idx + 1)}
                onPageSizeChange={(size) => {
                  setPaginationPageSize(size);
                  setPaginationCurrentPage(1);
                }}
                pageSizeOptions={["10", "25", "50"]}
                selectClassNames={erpListGeistSelectClassNames}
              />
            ),
            /*
             * Always render the table so `<thead>` (column-header filters)
             * and the pagination footer stay visible. While loading, MRT
             * shows `renderEmptyRowsFallback` (the loader) inside `<tbody>`
             * only — matching ReceiptMaster's UX.
             */
            children: <MantineReactTable table={table} />,
          }}
        />
      </Box>
    </MantineProvider>
  );
}
