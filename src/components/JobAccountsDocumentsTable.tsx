import { Fragment, type ReactNode, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Center,
  Group,
  Loader,
  Menu,
  Pagination,
  ScrollArea,
  Table,
  Text,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconReceiptRefund,
  IconRefresh,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { JobInvoiceDeleteConfirmModalProps } from "./JobInvoiceDeleteConfirmModal";
import { JobInvoiceDeleteConfirmModal } from "./JobInvoiceDeleteConfirmModal";
import { JobInvoiceDeleteMenuItem } from "./JobInvoiceDeleteMenuItem";
import { JobReverseInvoiceAccountMenu } from "./JobReverseInvoiceAccountMenu";
import {
  DEFAULT_ERP_LIST_THEME,
  ERPListColumnHeaderFilter,
} from "./ERPListPage";
import ToastNotification from "./ToastNotification";
import { formatInvoiceDocumentNo } from "../utils/invoiceDocumentNumber";
import {
  getInvoiceStatusBadgeColor,
  parseInvoiceStatus,
} from "../utils/invoiceStatus";
import {
  resolveDeactivatableFinanceKind,
  type DeactivatableFinanceKind,
} from "../utils/deactivateFinanceDocument";
import {
  getJobFinanceDocumentId,
  getJobFinanceReverseDocumentId,
  isRcmSupplierInvoiceDocument,
  JOB_FINANCE_DOCUMENTS_PAGE_SIZE,
  normalizeJobFinanceDocumentType,
  type JobFinanceDocument,
  type JobFinanceDocumentsSearchFilters,
  type JobFinanceReverseDocument,
} from "../utils/jobFinanceDocuments";

const UNCONFIGURED_DOCUMENT_TOAST = "Unconfigured document";

function isRcmSupplierInvoice(
  row: JobFinanceDocument | JobFinanceReverseDocument,
): boolean {
  return isRcmSupplierInvoiceDocument(row);
}

const menuItemStyles = {
  item: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
    borderRadius: "6px",
    padding: "10px 12px",
    marginBottom: "4px",
    "&:hover": {
      backgroundColor: "#F8F9FA",
    },
  },
  itemLabel: {
    fontFamily: "Inter",
    fontSize: "13px",
    fontWeight: 500,
    color: "#424242",
  },
};

const iconBoxStyle = {
  backgroundColor: "#E7F5FF",
  borderRadius: "6px",
  padding: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

function MenuIcon({ children }: { children: ReactNode }) {
  return <Box style={iconBoxStyle}>{children}</Box>;
}

function formatLocalTotal(value: string | number | null | undefined): string {
  if (value == null || value === "") return "-";
  return String(value);
}

function normalizeDocumentType(value: unknown): string {
  return normalizeJobFinanceDocumentType(value);
}

/** Credit notes cannot be reversed. Invoice reversal stays available for invoices. */
function isCreditNoteFinanceDocument(row: JobFinanceDocument): boolean {
  const docType = normalizeDocumentType(row.document_type).replace(
    /[\s-]+/g,
    "_",
  );
  if (
    docType === "credit_note" ||
    docType === "crn" ||
    docType === "cn" ||
    docType === "cdn"
  ) {
    return true;
  }

  const bookType = String(
    row.day_book_type ?? row.day_book_document_type ?? "",
  )
    .trim()
    .toUpperCase();
  if (bookType === "CRN" || bookType === "CN" || bookType === "CDN") {
    return true;
  }

  const bookName = String(row.day_book_name ?? "")
    .trim()
    .toLowerCase();
  if (
    bookName === "crn" ||
    bookName === "cn" ||
    bookName.includes("credit note")
  ) {
    return true;
  }

  const headerDrCr = String(row.Dr_Cr ?? row.dr_cr ?? "")
    .trim()
    .toLowerCase();
  return headerDrCr === "cr";
}

function canEditPaymentRequest(status?: string | null): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  // Rejected stays locked. Approved remains editable so Actual Invoice No/Date
  // can be set once from job Accounts (approve/reject stay approval-list only).
  return s !== "rejected";
}

export type JobAccountsDocumentsTableProps = {
  documents: JobFinanceDocument[];
  loading: boolean;
  jobBasePath: string;
  /** Job/house Accounts tab index — restored when navigating back from a document. */
  accountsTabIndex: number;
  isReadOnly?: boolean;
  job?: unknown;
  deletingId: number | null;
  expandedRowId: string | null;
  setExpandedRowId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void;
  onRequestDeleteInvoice: (invoiceId: number) => void;
  onRequestDeleteReverseInvoice: (reverseInvoiceId: number) => void;
  /** Prefer this for all unposted document deletes (inv/crn/rpt/pmt/jv + reverses). */
  onRequestDeleteDocument?: (
    kind: DeactivatableFinanceKind,
    documentId: number,
  ) => void;
  deleteConfirmProps: JobInvoiceDeleteConfirmModalProps;
  /** Extra location.state fields (e.g. service-job returnTo). */
  navigationStateExtras?: Record<string, unknown>;
  title?: string;
  total?: number;
  pageIndex?: number;
  pageSize?: number;
  onPageChange?: (pageIndex: number) => void;
  searchFilters?: JobFinanceDocumentsSearchFilters;
  onSearchFilterChange?: (
    key: keyof JobFinanceDocumentsSearchFilters,
    value: string,
  ) => void;
};

type AccountsHeaderFilterKey = keyof JobFinanceDocumentsSearchFilters;

export function JobAccountsDocumentsTable({
  documents,
  loading,
  jobBasePath,
  accountsTabIndex,
  isReadOnly = false,
  job,
  deletingId,
  expandedRowId,
  setExpandedRowId,
  onRequestDeleteInvoice,
  onRequestDeleteReverseInvoice,
  onRequestDeleteDocument,
  deleteConfirmProps,
  navigationStateExtras,
  title = "Accounts",
  total = 0,
  pageIndex = 0,
  pageSize = JOB_FINANCE_DOCUMENTS_PAGE_SIZE,
  onPageChange,
  searchFilters,
  onSearchFilterChange,
}: JobAccountsDocumentsTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const colCount = 7;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showPagination = total > pageSize && typeof onPageChange === "function";
  const [editingHeaderId, setEditingHeaderId] =
    useState<AccountsHeaderFilterKey | null>(null);
  const erpTheme = DEFAULT_ERP_LIST_THEME;
  const filters = searchFilters ?? {
    day_book_name: "",
    document_no: "",
    party_name: "",
    status: "",
  };
  const canSearch = typeof onSearchFilterChange === "function";

  const accountsReturnNav = useMemo(() => {
    const extras = navigationStateExtras ?? {};
    const extrasReturnTo =
      typeof extras.returnTo === "string" ? extras.returnTo.trim() : "";
    const extrasReturnState =
      extras.returnToState && typeof extras.returnToState === "object"
        ? (extras.returnToState as Record<string, unknown>)
        : {};
    const currentState =
      location.state && typeof location.state === "object"
        ? (location.state as Record<string, unknown>)
        : {};
    return {
      returnTo: extrasReturnTo || `${location.pathname}${location.search}`,
      returnToState: {
        ...currentState,
        ...extrasReturnState,
        ...(job ? { job } : {}),
        activeTab: accountsTabIndex,
      },
    };
  }, [
    navigationStateExtras,
    location.pathname,
    location.search,
    location.state,
    job,
    accountsTabIndex,
  ]);

  const withNavState = (state: Record<string, unknown>) => ({
    ...state,
    ...(job ? { job } : {}),
    ...accountsReturnNav,
  });

  const requestDelete = (kind: DeactivatableFinanceKind, documentId: number) => {
    if (onRequestDeleteDocument) {
      onRequestDeleteDocument(kind, documentId);
      return;
    }
    if (kind === "invoice" || kind === "credit_note") {
      onRequestDeleteInvoice(documentId);
      return;
    }
    if (kind === "reverse_invoice") {
      onRequestDeleteReverseInvoice(documentId);
    }
  };

  const renderUnpostedDelete = (
    row: JobFinanceDocument,
    docId: number | null,
  ) => {
    if (isReadOnly) return null;
    const { isUnposted } = parseInvoiceStatus(row.status);
    if (!isUnposted) return null;
    const kind =
      resolveDeactivatableFinanceKind(row.document_type) ??
      (isCreditNoteFinanceDocument(row) ? "credit_note" : null);
    if (!kind || docId == null) {
      return (
        <JobInvoiceDeleteMenuItem
          onDelete={() =>
            ToastNotification({
              type: "error",
              message: UNCONFIGURED_DOCUMENT_TOAST,
            })
          }
        />
      );
    }
    return (
      <JobInvoiceDeleteMenuItem
        disabled={deletingId === docId}
        onDelete={() => requestDelete(kind, docId)}
      />
    );
  };

  const renderHeaderFilter = (
    key: AccountsHeaderFilterKey,
    label: string,
  ) => {
    if (!canSearch) {
      return label;
    }
    return (
      <ERPListColumnHeaderFilter
        label={label}
        value={filters[key] ?? ""}
        onChange={(next) => onSearchFilterChange?.(key, next)}
        theme={erpTheme}
        placeholder={`Search ${label}`}
        ariaLabel={`Search ${label}`}
        isEditing={editingHeaderId === key}
        onStartEdit={() => setEditingHeaderId(key)}
        onStopEdit={() =>
          setEditingHeaderId((prev) => (prev === key ? null : prev))
        }
      />
    );
  };

  const renderSupplierReverseMenu = (
    rev: JobFinanceReverseDocument,
    parent: JobFinanceDocument,
  ) => {
    const reverseId = getJobFinanceReverseDocumentId(
      rev,
      parent.document_type,
    );
    const { isUnposted } = parseInvoiceStatus(rev.status);
    const rcm =
      isRcmSupplierInvoice(parent) || isRcmSupplierInvoice(rev);
    const basePath = rcm
      ? "/supplier-invoice-rcm/reversal"
      : "/supplier-invoice/reversal";
    return (
      <Menu shadow="md" width={200} position="bottom-end">
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="#105476"
            size="sm"
            styles={{
              root: {
                fontFamily: "Inter",
                fontSize: "13px",
                border: "1px solid #E9ECEF",
                borderRadius: "8px",
                "&:hover": { backgroundColor: "#F8F9FA" },
              },
            }}
          >
            <IconDotsVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown
          styles={{
            dropdown: {
              border: "1px solid #E9ECEF",
              borderRadius: "8px",
              padding: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            },
          }}
        >
          <Menu.Item
            leftSection={
              <MenuIcon>
                <IconEye size={16} color="#105476" />
              </MenuIcon>
            }
            styles={menuItemStyles}
            onClick={() =>
              navigate(`${basePath}/view`, {
                state: withNavState({
                  ...parent,
                  ...rev,
                  ...(reverseId != null ? { id: reverseId } : {}),
                }),
              })
            }
          >
            View
          </Menu.Item>
          {isUnposted && !isReadOnly && reverseId != null ? (
            <>
              <Menu.Item
                leftSection={
                  <MenuIcon>
                    <IconEdit size={16} color="#105476" />
                  </MenuIcon>
                }
                styles={menuItemStyles}
                onClick={() =>
                  navigate(`${basePath}/edit`, {
                    state: withNavState({
                      ...parent,
                      ...rev,
                      id: reverseId,
                    }),
                  })
                }
              >
                Edit
              </Menu.Item>
              <JobInvoiceDeleteMenuItem
                disabled={deletingId === reverseId}
                onDelete={() =>
                  requestDelete("reverse_supplier_invoice", reverseId)
                }
              />
            </>
          ) : null}
        </Menu.Dropdown>
      </Menu>
    );
  };

  const renderParentActions = (row: JobFinanceDocument) => {
    const docType = normalizeDocumentType(row.document_type);
    const docId = getJobFinanceDocumentId(row);
    const { isPosted, isUnposted } = parseInvoiceStatus(row.status);

    if (
      (docType === "invoice" ||
        docType === "credit_note" ||
        docType === "crn" ||
        docType === "cn") &&
      docId != null
    ) {
      const isCreditNote =
        docType === "credit_note" ||
        docType === "crn" ||
        docType === "cn" ||
        isCreditNoteFinanceDocument(row);
      const viewPath = isCreditNote
        ? `${jobBasePath}/credit-note/view/${docId}`
        : `${jobBasePath}/invoice/view/${docId}`;
      const editPath = isCreditNote
        ? `${jobBasePath}/credit-note/edit/${docId}`
        : `${jobBasePath}/invoice/edit/${docId}`;
      const deleteKind: DeactivatableFinanceKind = isCreditNote
        ? "credit_note"
        : "invoice";
      return (
        <>
          <Menu.Item
            leftSection={
              <MenuIcon>
                <IconEye size={16} color="#105476" />
              </MenuIcon>
            }
            styles={menuItemStyles}
            onClick={() =>
              navigate(viewPath, {
                state: withNavState({
                  invoiceData: row,
                  fromJobLevel: true,
                }),
              })
            }
          >
            View
          </Menu.Item>
          {isUnposted && !isReadOnly ? (
            <>
              <Menu.Item
                leftSection={
                  <MenuIcon>
                    <IconEdit size={16} color="#105476" />
                  </MenuIcon>
                }
                styles={menuItemStyles}
                onClick={() =>
                  navigate(editPath, {
                    state: withNavState({
                      invoiceData: row,
                      fromJobLevel: true,
                    }),
                  })
                }
              >
                Edit
              </Menu.Item>
              <JobInvoiceDeleteMenuItem
                disabled={deletingId === docId}
                onDelete={() => requestDelete(deleteKind, docId)}
              />
            </>
          ) : null}
          {isPosted && !isReadOnly && !isCreditNote ? (
            <Menu.Item
              leftSection={
                <MenuIcon>
                  <IconRefresh size={16} color="#105476" />
                </MenuIcon>
              }
              styles={menuItemStyles}
              onClick={() =>
                navigate(`${jobBasePath}/invoice/reverse`, {
                  state: withNavState({
                    document_no: row.document_no ?? "",
                  }),
                })
              }
            >
              Invoice Reversal
            </Menu.Item>
          ) : null}
        </>
      );
    }

    if (docType === "supplier_invoice" && docId != null) {
      const canEdit = isUnposted || isPosted;
      const rcm = isRcmSupplierInvoice(row);
      const basePath = rcm ? "/supplier-invoice-rcm" : "/supplier-invoice";
      return (
        <>
          <Menu.Item
            leftSection={
              <MenuIcon>
                <IconEye size={16} color="#105476" />
              </MenuIcon>
            }
            styles={menuItemStyles}
            onClick={() =>
              navigate(
                rcm ? `${basePath}/view` : `${basePath}/view/${docId}`,
                {
                  state: withNavState({ ...row, id: docId }),
                },
              )
            }
          >
            View
          </Menu.Item>
          {canEdit && !isReadOnly ? (
            <Menu.Item
              leftSection={
                <MenuIcon>
                  <IconEdit size={16} color="#105476" />
                </MenuIcon>
              }
              styles={menuItemStyles}
              onClick={() =>
                navigate(
                  rcm ? `${basePath}/edit` : `${basePath}/edit/${docId}`,
                  {
                    state: withNavState({ ...row, id: docId }),
                  },
                )
              }
            >
              Edit
            </Menu.Item>
          ) : null}
          {renderUnpostedDelete(row, docId)}
          {isPosted && !isReadOnly ? (
            <Menu.Item
              leftSection={
                <MenuIcon>
                  <IconReceiptRefund size={16} color="#105476" />
                </MenuIcon>
              }
              styles={menuItemStyles}
              onClick={() => {
                // Same payload as Supplier Invoice list "Create Supplier Invoice Reverse":
                // drop attachments, and pass supplier-invoice `id` + `crj_number`.
                // Job finance rows store those as supplier_invoice_id and document_no.
                const invoiceDataWithoutDocuments: Record<string, unknown> = {
                  ...row,
                };
                delete invoiceDataWithoutDocuments.documents;
                delete invoiceDataWithoutDocuments.supporting_documents;
                delete invoiceDataWithoutDocuments.reverse;
                const crjNumber = String(
                  row.crj_number ?? row.document_no ?? "",
                ).trim();
                navigate(`${basePath}/reversal/create`, {
                  state: withNavState({
                    ...invoiceDataWithoutDocuments,
                    id: docId,
                    ...(crjNumber ? { crj_number: crjNumber } : {}),
                  }),
                });
              }}
            >
              {rcm
                ? "Supplier Invoice (RCM) Reversal"
                : "Supplier Invoice Reversal"}
            </Menu.Item>
          ) : null}
        </>
      );
    }

    if (docType === "payment_request" && docId != null) {
      return (
        <>
          <Menu.Item
            leftSection={
              <MenuIcon>
                <IconEye size={16} color="#105476" />
              </MenuIcon>
            }
            styles={menuItemStyles}
            onClick={() =>
              navigate(`/payment-request/view/${docId}`, {
                state: withNavState({ ...row, fromJobAccounts: true }),
              })
            }
          >
            View
          </Menu.Item>
          {canEditPaymentRequest(row.status) && !isReadOnly ? (
            <Menu.Item
              leftSection={
                <MenuIcon>
                  <IconEdit size={16} color="#105476" />
                </MenuIcon>
              }
              styles={menuItemStyles}
              onClick={() =>
                navigate(`/payment-request/edit/${docId}`, {
                  state: withNavState({ ...row, fromJobAccounts: true }),
                })
              }
            >
              Edit
            </Menu.Item>
          ) : null}
        </>
      );
    }

    const financeNav: Record<
      string,
      { view: string; edit: string; stateAsRow?: boolean }
    > = {
      receipt: { view: "/receipt/view", edit: "/receipt/edit", stateAsRow: true },
      overseas_receipt: {
        view: "/overseas-receipt/view",
        edit: "/overseas-receipt/edit",
        stateAsRow: true,
      },
      reverse_receipt: {
        view: "/receipt/reversal/view",
        edit: "/receipt/reversal/edit",
        stateAsRow: true,
      },
      payment: { view: "/payment/view", edit: "/payment/edit", stateAsRow: true },
      overseas_payment: {
        view: "/overseas-payment/view",
        edit: "/overseas-payment/edit",
        stateAsRow: true,
      },
      reverse_payment: {
        view: "/payment/reversal/view",
        edit: "/payment/reversal/edit",
        stateAsRow: true,
      },
      journal_voucher: {
        view: docId != null ? `/journal-voucher/view/${docId}` : "/journal-voucher",
        edit: docId != null ? `/journal-voucher/edit/${docId}` : "/journal-voucher",
      },
      reverse_voucher: {
        view:
          docId != null
            ? `/journal-voucher-reversal/view/${docId}`
            : "/journal-voucher-reversal",
        edit:
          docId != null
            ? `/journal-voucher-reversal/edit/${docId}`
            : "/journal-voucher-reversal",
      },
      reverse_supplier_invoice: {
        view: isRcmSupplierInvoice(row)
          ? "/supplier-invoice-rcm/reversal/view"
          : "/supplier-invoice/reversal/view",
        edit: isRcmSupplierInvoice(row)
          ? "/supplier-invoice-rcm/reversal/edit"
          : "/supplier-invoice/reversal/edit",
        stateAsRow: true,
      },
      reverse_invoice: {
        view: `${jobBasePath}/invoice/reverse`,
        edit: `${jobBasePath}/invoice/reverse`,
        stateAsRow: true,
      },
    };

    const nav = financeNav[docType];
    if (nav && docId != null) {
      const canEdit = isUnposted || isPosted;
      return (
        <>
          <Menu.Item
            leftSection={
              <MenuIcon>
                <IconEye size={16} color="#105476" />
              </MenuIcon>
            }
            styles={menuItemStyles}
            onClick={() =>
              navigate(nav.view, {
                state: withNavState(
                  nav.stateAsRow
                    ? { ...row, id: docId }
                    : { rowData: row },
                ),
              })
            }
          >
            View
          </Menu.Item>
          {canEdit && !isReadOnly ? (
            <Menu.Item
              leftSection={
                <MenuIcon>
                  <IconEdit size={16} color="#105476" />
                </MenuIcon>
              }
              styles={menuItemStyles}
              onClick={() =>
                navigate(nav.edit, {
                  state: withNavState(
                    nav.stateAsRow
                      ? { ...row, id: docId }
                      : { rowData: row },
                  ),
                })
              }
            >
              Edit
            </Menu.Item>
          ) : null}
          {renderUnpostedDelete(row, docId)}
        </>
      );
    }

    return (
      <>
        <Menu.Item
          leftSection={
            <MenuIcon>
              <IconEye size={16} color="#105476" />
            </MenuIcon>
          }
          styles={menuItemStyles}
          disabled
        >
          View
        </Menu.Item>
        {renderUnpostedDelete(row, docId)}
      </>
    );
  };

  return (
    <Box mt="md">
      <Text size="md" fw={600} c="#105476" mb="md">
        {title}
      </Text>
      <ScrollArea>
        <Table
          withTableBorder
          withColumnBorders
          striped
          highlightOnHover
          style={{ minWidth: 700 }}
          styles={{
            th: { padding: "8px", minHeight: 36, verticalAlign: "middle" },
            td: { padding: "8px" },
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ fontSize: "12px", fontWeight: 600, width: "20%" }}>
                {renderHeaderFilter("day_book_name", "Daybook")}
              </Table.Th>
              <Table.Th style={{ fontSize: "12px", fontWeight: 600, width: "20%" }}>
                {renderHeaderFilter("document_no", "Document Number")}
              </Table.Th>
              <Table.Th style={{ fontSize: "12px", fontWeight: 600, width: "20%" }}>
                {renderHeaderFilter("party_name", "Party Name")}
              </Table.Th>
              <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                Invoice Date
              </Table.Th>
              <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                Invoice Total
              </Table.Th>
              <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                {renderHeaderFilter("status", "Status")}
              </Table.Th>
              <Table.Th style={{ fontSize: "12px", fontWeight: 600 }}>
                Actions
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={colCount}>
                  <Center py="xl">
                    <Loader color="#105476" size="lg" />
                  </Center>
                </Table.Td>
              </Table.Tr>
            ) : documents.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={colCount}>
                  <Center py="xl">
                    <Text c="dimmed">No documents to display</Text>
                  </Center>
                </Table.Td>
              </Table.Tr>
            ) : (
              documents.map((row, idx) => {
                  const docId = getJobFinanceDocumentId(row);
                  const rowKey = `${normalizeDocumentType(row.document_type)}-${docId ?? row.sno ?? idx}-${idx}`;
                  const isExpanded = expandedRowId === rowKey;
                  const reverseDocs = row.reverse ?? [];
                  const hasReverse = reverseDocs.length > 0;
                  const docType = normalizeDocumentType(row.document_type);

                  return (
                    <Fragment key={rowKey}>
                      <Table.Tr
                        style={
                          hasReverse ? { cursor: "pointer" } : undefined
                        }
                        onClick={(e) => {
                          if (
                            (e.target as HTMLElement).closest(
                              "[data-menu-dropdown],[button]",
                            )
                          ) {
                            return;
                          }
                          if (!hasReverse) {
                            setExpandedRowId(null);
                            return;
                          }
                          setExpandedRowId((prev) =>
                            prev === rowKey ? null : rowKey,
                          );
                        }}
                      >
                        <Table.Td style={{ fontSize: "13px", width: "20%" }}>
                          <Group gap="xs" wrap="nowrap">
                            {hasReverse && (
                              <Box
                                component="span"
                                style={{ display: "inline-flex" }}
                              >
                                {isExpanded ? (
                                  <IconChevronUp size={14} color="#105476" />
                                ) : (
                                  <IconChevronDown size={14} color="#105476" />
                                )}
                              </Box>
                            )}
                            {row.day_book_name ?? "-"}
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ fontSize: "13px", width: "20%" }}>
                          {row.document_no ?? "-"}
                        </Table.Td>
                        <Table.Td style={{ fontSize: "13px", width: "20%" }}>
                          {row.party_name ?? "-"}
                        </Table.Td>
                        <Table.Td style={{ fontSize: "13px", width: "15%" }}>
                          {row.document_date ?? "-"}
                        </Table.Td>
                        <Table.Td style={{ fontSize: "13px", width: "15%" }}>
                          {formatLocalTotal(row.local_total)}
                        </Table.Td>
                        <Table.Td style={{ fontSize: "13px", width: "15%" }}>
                          <Badge
                            size="sm"
                            variant="light"
                            color={getInvoiceStatusBadgeColor(row.status)}
                          >
                            {row.status ?? "-"}
                          </Badge>
                        </Table.Td>
                        <Table.Td
                          style={{ fontSize: "13px", width: "15%" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Menu
                            shadow="md"
                            width={220}
                            position="bottom-end"
                          >
                            <Menu.Target>
                              <ActionIcon
                                variant="subtle"
                                color="#105476"
                                size="sm"
                                styles={{
                                  root: {
                                    fontFamily: "Inter",
                                    fontSize: "13px",
                                    border: "1px solid #E9ECEF",
                                    borderRadius: "8px",
                                    "&:hover": {
                                      backgroundColor: "#F8F9FA",
                                    },
                                  },
                                }}
                              >
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown
                              styles={{
                                dropdown: {
                                  border: "1px solid #E9ECEF",
                                  borderRadius: "8px",
                                  padding: "8px",
                                  boxShadow:
                                    "0 4px 12px rgba(0, 0, 0, 0.1)",
                                },
                              }}
                            >
                              {renderParentActions(row)}
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>

                      {hasReverse && isExpanded && (
                        <Table.Tr>
                          <Table.Td
                            colSpan={colCount}
                            style={{
                              padding: 0,
                              verticalAlign: "top",
                              backgroundColor:
                                "var(--mantine-color-gray-0)",
                            }}
                          >
                            <Box p="sm" pl="xl">
                              <Table
                                withTableBorder
                                withColumnBorders
                                style={{ minWidth: 650 }}
                                styles={{
                                  th: { padding: "6px 8px" },
                                  td: { padding: "6px 8px" },
                                }}
                              >
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        width: "20%",
                                      }}
                                    >
                                      Daybook
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        width: "20%",
                                      }}
                                    >
                                      Document Number
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        width: "20%",
                                      }}
                                    >
                                      Party Name
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        width: "15%",
                                      }}
                                    >
                                      Invoice Date
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        width: "15%",
                                      }}
                                    >
                                      Invoice Total
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        width: "15%",
                                      }}
                                    >
                                      Status
                                    </Table.Th>
                                    <Table.Th
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        width: "15%",
                                      }}
                                    >
                                      Actions
                                    </Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {reverseDocs.map((rev, revIdx) => (
                                    <Table.Tr
                                      key={
                                        getJobFinanceReverseDocumentId(
                                          rev,
                                          row.document_type,
                                        ) ?? revIdx
                                      }
                                    >
                                      <Table.Td
                                        style={{
                                          fontSize: "12px",
                                          width: "20%",
                                        }}
                                      >
                                        {rev.day_book_name ?? "-"}
                                      </Table.Td>
                                      <Table.Td
                                        style={{
                                          fontSize: "12px",
                                          width: "20%",
                                        }}
                                      >
                                        {formatInvoiceDocumentNo(rev)}
                                      </Table.Td>
                                      <Table.Td
                                        style={{
                                          fontSize: "12px",
                                          width: "20%",
                                        }}
                                      >
                                        {rev.party_name ?? "-"}
                                      </Table.Td>
                                      <Table.Td
                                        style={{
                                          fontSize: "12px",
                                          width: "15%",
                                        }}
                                      >
                                        {rev.document_date ?? "-"}
                                      </Table.Td>
                                      <Table.Td
                                        style={{
                                          fontSize: "12px",
                                          width: "15%",
                                        }}
                                      >
                                        {formatLocalTotal(rev.local_total)}
                                      </Table.Td>
                                      <Table.Td
                                        style={{
                                          fontSize: "12px",
                                          width: "15%",
                                        }}
                                      >
                                        <Badge
                                          size="sm"
                                          variant="light"
                                          color={getInvoiceStatusBadgeColor(
                                            rev.status,
                                          )}
                                        >
                                          {rev.status ?? "-"}
                                        </Badge>
                                      </Table.Td>
                                      <Table.Td
                                        style={{
                                          fontSize: "12px",
                                          width: "15%",
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {docType === "supplier_invoice"
                                          ? renderSupplierReverseMenu(
                                              rev,
                                              row,
                                            )
                                          : (
                                            <JobReverseInvoiceAccountMenu
                                              rev={rev}
                                              readOnly={isReadOnly}
                                              parentRow={row}
                                              jobBasePath={jobBasePath}
                                              navigate={navigate}
                                              job={job}
                                              deletingReverseId={deletingId}
                                              onRequestDeleteReverseInvoice={
                                                onRequestDeleteReverseInvoice
                                              }
                                              navigationStateExtras={
                                                accountsReturnNav
                                              }
                                            />
                                          )}
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </Box>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      {showPagination ? (
        <Group justify="space-between" mt="md" wrap="wrap">
          <Text size="sm" c="dimmed">
            Showing {documents.length === 0 ? 0 : pageIndex * pageSize + 1}
            {"–"}
            {Math.min((pageIndex + 1) * pageSize, total)} of {total}
          </Text>
          <Pagination
            value={pageIndex + 1}
            onChange={(page) => {
              setExpandedRowId(null);
              onPageChange?.(page - 1);
            }}
            total={totalPages}
            color="#105476"
            size="sm"
          />
        </Group>
      ) : null}
      <JobInvoiceDeleteConfirmModal {...deleteConfirmProps} />
    </Box>
  );
}
