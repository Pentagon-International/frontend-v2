import { useCallback, useEffect, useMemo, useState } from "react";
import useAuthStore from "../../../store/authStore";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconDotsVertical, IconEye, IconFilter, IconSearch, IconX } from "@tabler/icons-react";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { Dropdown, FormTextInput } from "../../../components";
import {
  ERPListColumnHeaderFilter,
  ERPListFilterActionsFooter,
  ERPListPaginationFooter,
  ERPListScreen,
  erpListDataRowProps,
  erpListFilterFieldCellStyle,
  erpListFilterUnifiedMantineStyles,
  erpListGeistMantineTheme,
  erpListGeistMenuDropdownStyles,
  erpListGeistRootTypography,
  erpListGeistSelectClassNames,
  erpListStickyActionTdStyle,
  erpListStickyActionThStyle,
  erpListThStyle,
  erpToolbarOutlineButtonStyles,
  ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER,
  ERP_LIST_GEIST_ROOT_CLASS,
} from "../../../components/ERPListPage";
import useDateFormat from "../../../hooks/useDateFormat";
import { formatDateTimeForUi } from "../../../utils/dateFormat";
import {
  fetchCustomerPanPendingList,
  type CustomerPanApprovalRow,
} from "../../../service/customerPanApproval.service";
import {
  CustomerPanApprovalDetails,
  getForeignBranchProfile,
  getStatusBadgeColor,
  type ApprovalPartyType,
} from "./ApproveCustomerPanMaster";
import { isIndianUserFromProfile } from "../../../utils/userNumberFormat";
import {
  buildCustomerPanListApiFilters,
  CUSTOMER_PAN_APPROVAL_LIST_THEME,
  CUSTOMER_PAN_STATUS_FILTER_OPTIONS,
  customerPanStatusFilterLabel,
  DEFAULT_CUSTOMER_PAN_LIST_FILTERS,
  resolveUserEmail,
  type CustomerPanListFilterState,
} from "./customerPanApprovalListShared";

type TableRow = CustomerPanApprovalRow & { sno: number };

function ApprovalStatusRowActions({
  entityLabel,
  onView,
}: {
  entityLabel: string;
  onView: () => void;
}) {
  const [menuOpened, setMenuOpened] = useState(false);

  return (
    <Menu
      withinPortal
      position="bottom-end"
      shadow="sm"
      radius="md"
      opened={menuOpened}
      onChange={setMenuOpened}
      classNames={{ dropdown: ERP_LIST_GEIST_ROOT_CLASS }}
      styles={erpListGeistMenuDropdownStyles}
    >
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="Actions">
          <IconDotsVertical size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Box px={10} py={5}>
          <UnstyledButton
            onClick={() => {
              setMenuOpened(false);
              onView();
            }}
          >
            <Group gap="sm">
              <IconEye size={16} style={{ color: "#105476" }} />
              <Text size="sm">View {entityLabel}</Text>
            </Group>
          </UnstyledButton>
        </Box>
      </Menu.Dropdown>
    </Menu>
  );
}

export default function CustomerApprovalStatusMaster({
  partyType = "customer",
}: {
  partyType?: ApprovalPartyType;
} = {}) {
  const user = useAuthStore((state) => state.user);
  const isIndiaUser = isIndianUserFromProfile(user?.country);
  const isAdminUser = Boolean(user?.is_staff);
  const foreignBranchProfile = useMemo(
    () => getForeignBranchProfile(user?.country, user?.branches),
    [user?.country, user?.branches],
  );
  const currentUserEmail = useMemo(() => resolveUserEmail(user), [user]);
  const theme = CUSTOMER_PAN_APPROVAL_LIST_THEME;
  const filterFieldStyles = useMemo(
    () => erpListFilterUnifiedMantineStyles(theme),
    [theme],
  );
  const entityLabel =
    partyType === "vendor"
      ? "Vendor"
      : partyType === "agent"
        ? "Agent"
        : "Customer";
  const entityLabelLower = partyType;
  const dateFormat = useDateFormat();
  const tdPad = { padding: "10px 12px" as const };
  const mergeTh = (minW: number, widthPx?: number) => ({
    ...erpListThStyle(theme),
    minWidth: minW,
    ...(widthPx != null ? { width: widthPx } : {}),
  });
  /** Equal share of leftover table width (table-layout: fixed). */
  const equalShareTh = {
    ...erpListThStyle(theme),
    minWidth: 120,
  };
  const actionsThStyle = {
    ...erpListStickyActionThStyle(theme, 72),
    width: 72,
    minWidth: 72,
    maxWidth: 72,
    padding: "6px 8px",
    textAlign: "center" as const,
  };
  const actionsTdStyle = {
    ...erpListStickyActionTdStyle(theme, { paddingInline: "8px" }),
    width: 72,
    minWidth: 72,
    maxWidth: 72,
    padding: "8px 6px",
    textAlign: "center" as const,
  };

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [viewRow, setViewRow] = useState<CustomerPanApprovalRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [draftFilters, setDraftFilters] = useState<CustomerPanListFilterState>(
    DEFAULT_CUSTOMER_PAN_LIST_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] =
    useState<CustomerPanListFilterState>(DEFAULT_CUSTOMER_PAN_LIST_FILTERS);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);

  const apiFilters = useMemo(
    () =>
      buildCustomerPanListApiFilters({
        appliedFilters,
        debouncedSearch,
        partyType,
        // Non-admins stay scoped to their mapping; admins see all records.
        fixedAssignedTo: isAdminUser ? undefined : currentUserEmail || undefined,
      }),
    [
      appliedFilters,
      partyType,
      debouncedSearch,
      isAdminUser,
      currentUserEmail,
    ],
  );

  const {
    data: listResult,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "customerPanSubmittedByUser",
      partyType,
      pageIndex,
      pageSize,
      isAdminUser,
      apiFilters.assigned_to,
      apiFilters.created_by,
      apiFilters.customer_name,
      apiFilters.status,
      apiFilters.approved_by,
    ],
    queryFn: async () => {
      const index = pageIndex * pageSize;
      return fetchCustomerPanPendingList(index, pageSize, apiFilters);
    },
    enabled: isAdminUser || Boolean(apiFilters.assigned_to),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (listResult) {
      setTotalCount(listResult.total);
    }
  }, [listResult]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch]);

  const displayRows = useMemo<TableRow[]>(() => {
    const rawRows = listResult?.rows ?? [];
    return rawRows.map((row, index) => ({
      ...row,
      sno: row.sno ?? pageIndex * pageSize + index + 1,
    }));
  }, [listResult?.rows, pageIndex, pageSize]);

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setPageIndex(0);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_CUSTOMER_PAN_LIST_FILTERS);
    setAppliedFilters(DEFAULT_CUSTOMER_PAN_LIST_FILTERS);
    setSearch("");
    setPageIndex(0);
  };

  const commitHeaderFilters = useCallback(
    (updater: (prev: CustomerPanListFilterState) => CustomerPanListFilterState) => {
      setAppliedFilters((prev) => {
        const next = updater(prev);
        setDraftFilters(next);
        return next;
      });
      setPageIndex(0);
    },
    [],
  );

  const openHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId(id);
  }, []);

  const collapseHeaderEditor = useCallback((id: string) => {
    setEditingHeaderId((current) => (current === id ? null : current));
  }, []);

  const tableLoading = isLoading || isFetching;

  return (
    <>
      <MantineProvider theme={erpListGeistMantineTheme}>
        <Box
          className={ERP_LIST_GEIST_ROOT_CLASS}
          style={erpListGeistRootTypography}
        >
          <ERPListScreen
            theme={theme}
            className={ERP_LIST_GEIST_ROOT_CLASS}
            toolbar={{
              leading: (
                <Text fw={600} size="sm" c={theme.fg}>
                  {entityLabel} Approval Status
                </Text>
              ),
              actions: (
                <>
                  <TextInput
                    size="xs"
                    w={220}
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    leftSection={<IconSearch size={14} />}
                    rightSection={
                      search ? (
                        <ActionIcon
                          variant="transparent"
                          size="sm"
                          onClick={() => setSearch("")}
                          aria-label="Clear search"
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      ) : null
                    }
                    styles={{
                      input: {
                        fontFamily: theme.fontSans,
                        fontSize: 12,
                        height: 32,
                        borderColor: theme.border,
                      },
                    }}
                  />
                  <Button
                    variant="default"
                    size="xs"
                    styles={erpToolbarOutlineButtonStyles(theme)}
                    leftSection={<IconFilter size={14} />}
                    onClick={() => setShowFilters((s) => !s)}
                  >
                    {showFilters ? "Hide filters" : "Filters"}
                  </Button>
                </>
              ),
            }}
            filters={{
              opened: showFilters,
              title: "Filters",
              subtitle: `${entityLabel} name, assign to, status, and approve by`,
              onClose: () => setShowFilters(false),
              footer: (
                <ERPListFilterActionsFooter
                  theme={theme}
                  onClear={clearFilters}
                  onApply={applyFilters}
                  applyLoading={tableLoading}
                  applyDisabled={tableLoading}
                />
              ),
              children: (
                <Grid gutter={{ base: "sm", md: "md" }} align="stretch">
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <FormTextInput
                        format="normal"
                        label={`${entityLabel} Name`}
                        placeholder="Search by name"
                        size="xs"
                        value={draftFilters.customer_name}
                        onChange={(e) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            customer_name: e.target.value,
                          }))
                        }
                        styles={filterFieldStyles}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <FormTextInput
                        format="normal"
                        label="Assign To"
                        placeholder="Filter by assign to"
                        size="xs"
                        value={draftFilters.assigned_to}
                        onChange={(e) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            assigned_to: e.target.value,
                          }))
                        }
                        styles={filterFieldStyles}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <Dropdown
                        label="Status"
                        data={CUSTOMER_PAN_STATUS_FILTER_OPTIONS}
                        value={draftFilters.status}
                        onChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            status: value ?? "",
                          }))
                        }
                        size="xs"
                        styles={filterFieldStyles}
                      />
                    </Box>
                  </Grid.Col>
                  <Grid.Col span={ERP_LIST_FILTER_FIELD_COL_SPAN_QUARTER}>
                    <Box style={erpListFilterFieldCellStyle}>
                      <FormTextInput
                        format="normal"
                        label="Approve By"
                        placeholder="Filter by approve by"
                        size="xs"
                        value={draftFilters.approved_by}
                        onChange={(e) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            approved_by: e.target.value,
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
                  theme={theme}
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  totalRecords={totalCount}
                  onPageIndexChange={setPageIndex}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPageIndex(0);
                  }}
                />
              ),
              children: (
                <table
                  style={{
                    width: "100%",
                    tableLayout: "fixed",
                    borderCollapse: "collapse",
                    fontSize: 14,
                    backgroundColor: theme.cardBg,
                    fontFamily: theme.fontSans,
                  }}
                >
                  <thead>
                    <tr style={{ height: 45 }}>
                      <th style={mergeTh(56, 56)}>S.No</th>
                      <th style={mergeTh(280, 280)}>
                        <ERPListColumnHeaderFilter
                          label={`${entityLabel} Name`}
                          value={appliedFilters.customer_name}
                          theme={theme}
                          placeholder={`Filter ${entityLabelLower} name`}
                          isEditing={editingHeaderId === "customer_name"}
                          onStartEdit={() => openHeaderEditor("customer_name")}
                          onStopEdit={() =>
                            collapseHeaderEditor("customer_name")
                          }
                          onChange={(next) =>
                            commitHeaderFilters((prev) => ({
                              ...prev,
                              customer_name: next,
                            }))
                          }
                        />
                      </th>
                      <th style={mergeTh(110, 110)}>Term Code</th>
                      <th style={equalShareTh}>
                        <ERPListColumnHeaderFilter
                          label="Assign To"
                          value={appliedFilters.assigned_to}
                          theme={theme}
                          placeholder="Filter assign to"
                          isEditing={editingHeaderId === "assigned_to"}
                          onStartEdit={() => openHeaderEditor("assigned_to")}
                          onStopEdit={() =>
                            collapseHeaderEditor("assigned_to")
                          }
                          onChange={(next) =>
                            commitHeaderFilters((prev) => ({
                              ...prev,
                              assigned_to: next,
                            }))
                          }
                        />
                      </th>
                      <th style={equalShareTh}>
                        <ERPListColumnHeaderFilter
                          label="Status"
                          value={appliedFilters.status}
                          displayValue={
                            appliedFilters.status
                              ? customerPanStatusFilterLabel(
                                  appliedFilters.status,
                                )
                              : undefined
                          }
                          theme={theme}
                          onChange={() => {}}
                          isEditing={editingHeaderId === "status"}
                          onStartEdit={() => openHeaderEditor("status")}
                          onStopEdit={() => collapseHeaderEditor("status")}
                          renderEditor={({ autoFocus, onClose }) => (
                            <Select
                              autoFocus={autoFocus}
                              placeholder="Select status"
                              size="xs"
                              data={CUSTOMER_PAN_STATUS_FILTER_OPTIONS}
                              value={appliedFilters.status}
                              onChange={(value) => {
                                commitHeaderFilters((prev) => ({
                                  ...prev,
                                  status: value ?? "",
                                }));
                                onClose();
                              }}
                              comboboxProps={{ zIndex: 1000 }}
                              classNames={erpListGeistSelectClassNames}
                              styles={filterFieldStyles}
                            />
                          )}
                        />
                      </th>
                      <th style={equalShareTh}>
                        <ERPListColumnHeaderFilter
                          label="Approved By"
                          value={appliedFilters.approved_by}
                          theme={theme}
                          placeholder="Filter approved by"
                          isEditing={editingHeaderId === "approved_by"}
                          onStartEdit={() => openHeaderEditor("approved_by")}
                          onStopEdit={() =>
                            collapseHeaderEditor("approved_by")
                          }
                          onChange={(next) =>
                            commitHeaderFilters((prev) => ({
                              ...prev,
                              approved_by: next,
                            }))
                          }
                        />
                      </th>
                      <th style={mergeTh(170, 170)}>Submitted On</th>
                      <th style={actionsThStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableLoading ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 48 }}>
                          <Group justify="center">
                            <Loader color="#105476" size="lg" />
                          </Group>
                        </td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 48 }}>
                          <Text ta="center" c="dimmed">
                            No {entityLabelLower} approval records found
                          </Text>
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((row) => (
                        <tr key={row.id} {...erpListDataRowProps(theme)}>
                          <td style={tdPad}>
                            <Text size="sm">{row.sno}</Text>
                          </td>
                          <td style={tdPad}>
                            <Text size="sm" fw={600} c={theme.primary} lineClamp={2}>
                              {row.customer_name || "—"}
                            </Text>
                          </td>
                          <td style={tdPad}>
                            <Text size="sm">{row.term_code || "—"}</Text>
                          </td>
                          <td style={tdPad}>
                            <Text size="sm" lineClamp={2}>
                              {row.created_by?.trim() || "—"}
                            </Text>
                          </td>
                          <td style={tdPad}>
                            <Badge
                              color={getStatusBadgeColor(row.status)}
                              size="sm"
                              variant="light"
                            >
                              {row.status?.trim() || "—"}
                            </Badge>
                          </td>
                          <td style={tdPad}>
                            <Text size="sm" lineClamp={2}>
                              {row.approved_by?.trim() || "—"}
                            </Text>
                          </td>
                          <td style={{ ...tdPad, whiteSpace: "nowrap" }}>
                            <Text size="sm" c={theme.muted} style={{ whiteSpace: "nowrap" }}>
                              {formatDateTimeForUi(row.created_at, dateFormat)}
                            </Text>
                          </td>
                          <td style={actionsTdStyle}>
                            <ApprovalStatusRowActions
                              entityLabel={entityLabel}
                              onView={() => setViewRow(row)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ),
            }}
          />
        </Box>
      </MantineProvider>

      <Modal
        opened={viewRow !== null}
        onClose={() => setViewRow(null)}
        title={`View ${entityLabel}`}
        centered
        size="xl"
      >
        <Stack gap="md">
          {viewRow && (
            <ScrollArea.Autosize mah="60vh" offsetScrollbars type="auto">
              <CustomerPanApprovalDetails
                row={viewRow}
                editable={false}
                partyType={partyType}
                requireIndiaTaxIds={isIndiaUser}
                foreignBranchProfile={foreignBranchProfile}
              />
            </ScrollArea.Autosize>
          )}
          <Divider />
          <Group justify="flex-end">
            <Button
              variant="outline"
              color="#105476"
              size="xs"
              onClick={() => setViewRow(null)}
            >
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
