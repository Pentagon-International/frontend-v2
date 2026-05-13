import { useEffect, useMemo, useState } from "react";
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
  MantineProvider,
  Menu,
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
import { useNavigate } from "react-router-dom";
import {
  Dropdown,
  ERPListColumnToggleMenu,
  ERPListFilterActionsFooter,
  ERPListScreen,
  ERPListStatPill,
  ERPListTableLoading,
  SearchableSelect,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpToolbarOutlineButtonStyles,
  ERP_LIST_FILTER_FIELD_COL_SPAN,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components";
import type { ErpListTheme } from "../../../components";
import { URL } from "../../../api/serverUrls";
import { apiCallProtected } from "../../../api/axios";
import { getBookingShipmentFilterListTotal } from "../../../utils/bookingShipmentFilterListTotal";
import PaginationBar from "../../../components/PaginationBar/PaginationBar";
import FormTextInput from "../../../components/FormTextInput";
import { getAPICall } from "../../../service/getApiCall";
import { API_HEADER } from "../../../store/storeKeys";

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
};

const EMPTY_FILTERS: InvoiceListFilters = {
  bill_to: "",
  party_display: null,
  document_no: "",
  shipment_no: "",
  state_id: "",
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
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(
    () => ({ ...columnDefault }),
  );
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<InvoiceListFilters>({
    ...EMPTY_FILTERS,
  });
  const [appliedFilters, setAppliedFilters] = useState<InvoiceListFilters>({
    ...EMPTY_FILTERS,
  });

  const index = pagination.pageIndex * pagination.pageSize;

  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [debouncedSearch]);

  const handlePageSizeChange = (size: number) => {
    setPagination({ pageIndex: 0, pageSize: size });
  };

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
    setPagination((p) => ({ ...p, pageIndex: 0 }));
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
    enabled: search === debouncedSearch,
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
    [erpTheme.fontSans, index, navigate, primary],
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
      const extraStyles =
        column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "30px",
              zIndex: 2,
              borderLeft: `1px solid ${border}`,
              boxShadow: "1px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
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
      const extraStyles =
        column.id === "actions"
          ? {
              position: "sticky" as const,
              right: 0,
              minWidth: "80px",
              zIndex: 2,
              backgroundColor: erpTheme.headerBg,
              boxShadow: "0px -2px 4px 0px #00000040",
            }
          : {};
      return {
        style: {
          width: "fit-content",
          padding: "8px 16px",
          fontSize: 14,
          fontFamily: erpTheme.fontSans,
          color: muted,
          backgroundColor: erpTheme.headerBg,
          borderBottom: `1px solid ${border}`,
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
                      onChange={(value) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          state_id: value ?? "",
                        }))
                      }
                      searchable
                      size="xs"
                      styles={filterFieldStyles}
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
            ) : loading ? (
              <ERPListTableLoading theme={erpTheme} message="Loading invoices…" />
            ) : (
              <MantineReactTable table={table} />
            ),
          }}
        />
      </Box>
    </MantineProvider>
  );
}
