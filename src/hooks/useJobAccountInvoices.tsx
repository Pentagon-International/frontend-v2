import { useCallback, useEffect, useMemo, useState } from "react";
import type { JobInvoiceDeleteConfirmModalProps } from "../components/JobInvoiceDeleteConfirmModal";
import { ToastNotification } from "../components";
import { API_HEADER } from "../store/storeKeys";
import { deactivateInvoice } from "../utils/deactivateInvoice";
import { deactivateReverseInvoice } from "../utils/deactivateReverseInvoice";
import {
  fetchJobFinanceDocuments,
  JOB_FINANCE_DOCUMENTS_PAGE_SIZE,
  type JobFinanceDocument,
  type JobFinanceDocumentsSearchFilters,
} from "../utils/jobFinanceDocuments";

type DeleteTarget =
  | { kind: "invoice"; id: number }
  | { kind: "reverse"; id: number };

type UseJobAccountInvoicesOptions = {
  activeTab: number;
  accountsTabIndex: number;
  /** Master-level filter: `filters.job_id` */
  jobId?: string | null;
  /** House-level filter: `filters.shipment_id` */
  shipmentId?: string | null;
  enabled?: boolean;
  pageSize?: number;
};

const EMPTY_SEARCH: JobFinanceDocumentsSearchFilters = {
  day_book_name: "",
  document_no: "",
  party_name: "",
  status: "",
};

export function useJobAccountInvoices({
  activeTab,
  accountsTabIndex,
  jobId,
  shipmentId,
  enabled = true,
  pageSize = JOB_FINANCE_DOCUMENTS_PAGE_SIZE,
}: UseJobAccountInvoicesOptions) {
  const [invoiceList, setInvoiceList] = useState<JobFinanceDocument[]>([]);
  const [invoiceListLoading, setInvoiceListLoading] = useState(false);
  const [invoiceListTotal, setInvoiceListTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchFilters, setSearchFilters] =
    useState<JobFinanceDocumentsSearchFilters>(EMPTY_SEARCH);
  const [invoiceDeletingId, setInvoiceDeletingId] = useState<number | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [expandedInvoiceRowId, setExpandedInvoiceRowId] = useState<
    string | null
  >(null);

  const filterKey = jobId?.trim() || shipmentId?.trim() || "";
  const searchKey = [
    searchFilters.day_book_name?.trim() ?? "",
    searchFilters.document_no?.trim() ?? "",
    searchFilters.party_name?.trim() ?? "",
    searchFilters.status?.trim() ?? "",
  ].join("|");

  useEffect(() => {
    setPageIndex(0);
    setExpandedInvoiceRowId(null);
  }, [filterKey, searchKey]);

  useEffect(() => {
    setSearchFilters(EMPTY_SEARCH);
    setPageIndex(0);
    setExpandedInvoiceRowId(null);
  }, [filterKey]);

  const setSearchFilter = useCallback(
    (key: keyof JobFinanceDocumentsSearchFilters, value: string) => {
      setSearchFilters((prev) => {
        if ((prev[key] ?? "") === value) return prev;
        return { ...prev, [key]: value };
      });
    },
    [],
  );

  const loadInvoiceList = useCallback(async () => {
    if (!filterKey) {
      setInvoiceList([]);
      setInvoiceListTotal(0);
      return;
    }
    setInvoiceListLoading(true);
    try {
      const res = await fetchJobFinanceDocuments({
        jobId: jobId?.trim() || null,
        shipmentId: !jobId?.trim() ? shipmentId?.trim() || null : null,
        index: pageIndex * pageSize,
        limit: pageSize,
        search: searchFilters,
      });
      setInvoiceList(res.data);
      setInvoiceListTotal(res.total);
      const maxPage = Math.max(0, Math.ceil(res.total / pageSize) - 1);
      if (pageIndex > maxPage) {
        setPageIndex(maxPage);
      }
    } catch {
      setInvoiceList([]);
      setInvoiceListTotal(0);
    } finally {
      setInvoiceListLoading(false);
    }
  }, [filterKey, jobId, shipmentId, pageIndex, pageSize, searchFilters]);

  useEffect(() => {
    if (!enabled) return;
    if (activeTab !== accountsTabIndex) return;
    if (!filterKey) return;
    loadInvoiceList();
  }, [enabled, activeTab, accountsTabIndex, filterKey, loadInvoiceList]);

  const requestDeleteInvoice = useCallback((invoiceId: number) => {
    setPendingDelete({ kind: "invoice", id: invoiceId });
  }, []);

  const requestDeleteReverseInvoice = useCallback(
    (reverseInvoiceId: number) => {
      setPendingDelete({ kind: "reverse", id: reverseInvoiceId });
    },
    [],
  );

  const cancelDeleteInvoice = useCallback(() => {
    if (invoiceDeletingId != null) return;
    setPendingDelete(null);
  }, [invoiceDeletingId]);

  const confirmDeleteInvoice = useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setInvoiceDeletingId(target.id);
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
      await loadInvoiceList();
      setPendingDelete(null);
    } catch {
      ToastNotification({
        type: "error",
        message:
          target.kind === "reverse"
            ? "Failed to delete reverse invoice. Please try again."
            : "Failed to delete invoice. Please try again.",
      });
    } finally {
      setInvoiceDeletingId(null);
    }
  }, [pendingDelete, loadInvoiceList]);

  const deleteConfirmProps: JobInvoiceDeleteConfirmModalProps = useMemo(
    () => ({
      opened: pendingDelete != null,
      loading: invoiceDeletingId != null,
      title:
        pendingDelete?.kind === "reverse"
          ? "Delete reverse invoice"
          : "Delete invoice",
      message:
        pendingDelete?.kind === "reverse"
          ? "Are you sure you want to delete this reverse invoice? This action cannot be undone."
          : "Are you sure you want to delete this invoice? This action cannot be undone.",
      onClose: cancelDeleteInvoice,
      onConfirm: confirmDeleteInvoice,
    }),
    [
      pendingDelete,
      invoiceDeletingId,
      cancelDeleteInvoice,
      confirmDeleteInvoice,
    ],
  );

  const totalPages = Math.max(1, Math.ceil(invoiceListTotal / pageSize));

  return {
    invoiceList,
    invoiceListLoading,
    invoiceListTotal,
    pageIndex,
    setPageIndex,
    pageSize,
    totalPages,
    searchFilters,
    setSearchFilter,
    invoiceDeletingId,
    expandedInvoiceRowId,
    setExpandedInvoiceRowId,
    loadInvoiceList,
    requestDeleteInvoice,
    requestDeleteReverseInvoice,
    deleteConfirmProps,
  };
}
