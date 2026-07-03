import { useCallback, useEffect, useMemo, useState } from "react";
import type { JobInvoiceDeleteConfirmModalProps } from "../components/JobInvoiceDeleteConfirmModal";
import { ToastNotification } from "../components";
import { API_HEADER } from "../store/storeKeys";
import { deactivateInvoice } from "../utils/deactivateInvoice";
import { deactivateReverseInvoice } from "../utils/deactivateReverseInvoice";
import { fetchJobInvoiceList } from "../utils/fetchJobInvoiceList";

type DeleteTarget =
  | { kind: "invoice"; id: number }
  | { kind: "reverse"; id: number };

type UseJobAccountInvoicesOptions = {
  activeTab: number;
  accountsTabIndex: number;
  shipmentNo?: string | null;
  isAgent?: boolean;
  enabled?: boolean;
};

export function useJobAccountInvoices<T>({
  activeTab,
  accountsTabIndex,
  shipmentNo,
  isAgent,
  enabled = true,
}: UseJobAccountInvoicesOptions) {
  const [invoiceList, setInvoiceList] = useState<T[]>([]);
  const [invoiceListLoading, setInvoiceListLoading] = useState(false);
  const [invoiceDeletingId, setInvoiceDeletingId] = useState<number | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [expandedInvoiceRowId, setExpandedInvoiceRowId] = useState<
    string | null
  >(null);

  const loadInvoiceList = useCallback(async () => {
    if (!shipmentNo) {
      setInvoiceList([]);
      return;
    }
    setInvoiceListLoading(true);
    try {
      const data = await fetchJobInvoiceList<T>(shipmentNo, isAgent);
      setInvoiceList(data);
    } catch {
      setInvoiceList([]);
    } finally {
      setInvoiceListLoading(false);
    }
  }, [shipmentNo, isAgent]);

  useEffect(() => {
    if (!enabled) return;
    if (activeTab !== accountsTabIndex) return;
    if (!shipmentNo) return;
    loadInvoiceList();
  }, [enabled, activeTab, accountsTabIndex, shipmentNo, loadInvoiceList]);

  const requestDeleteInvoice = useCallback((invoiceId: number) => {
    setPendingDelete({ kind: "invoice", id: invoiceId });
  }, []);

  const requestDeleteReverseInvoice = useCallback((reverseInvoiceId: number) => {
    setPendingDelete({ kind: "reverse", id: reverseInvoiceId });
  }, []);

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

  return {
    invoiceList,
    invoiceListLoading,
    invoiceDeletingId,
    expandedInvoiceRowId,
    setExpandedInvoiceRowId,
    loadInvoiceList,
    requestDeleteInvoice,
    requestDeleteReverseInvoice,
    deleteConfirmProps,
  };
}
