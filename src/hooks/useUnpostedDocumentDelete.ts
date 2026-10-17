import { useCallback, useMemo, useState } from "react";
import type { JobInvoiceDeleteConfirmModalProps } from "../components/JobInvoiceDeleteConfirmModal";
import { ToastNotification } from "../components";
import { API_HEADER } from "../store/storeKeys";
import {
  deactivateFinanceDocument,
  getFinanceDocumentDeleteLabels,
  type DeactivatableFinanceKind,
} from "../utils/deactivateFinanceDocument";

type DeleteTarget = { kind: DeactivatableFinanceKind; id: number };

type UseUnpostedDocumentDeleteOptions = {
  onDeleted?: () => void | Promise<void>;
};

export function useUnpostedDocumentDelete(
  options: UseUnpostedDocumentDeleteOptions = {},
) {
  const { onDeleted } = options;
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const requestDelete = useCallback(
    (kind: DeactivatableFinanceKind, id: number) => {
      if (!Number.isFinite(id) || id <= 0) return;
      setPendingDelete({ kind, id });
    },
    [],
  );

  const cancelDelete = useCallback(() => {
    if (deletingId != null) return;
    setPendingDelete(null);
  }, [deletingId]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    const labels = getFinanceDocumentDeleteLabels(target.kind);
    setDeletingId(target.id);
    try {
      await deactivateFinanceDocument(target.kind, target.id, API_HEADER);
      ToastNotification({ type: "success", message: labels.success });
      setPendingDelete(null);
      await onDeleted?.();
    } catch {
      ToastNotification({ type: "error", message: labels.failure });
    } finally {
      setDeletingId(null);
    }
  }, [pendingDelete, onDeleted]);

  const deleteConfirmProps: JobInvoiceDeleteConfirmModalProps = useMemo(() => {
    const labels = pendingDelete
      ? getFinanceDocumentDeleteLabels(pendingDelete.kind)
      : null;
    return {
      opened: pendingDelete != null,
      loading: deletingId != null,
      title: labels?.title ?? "Delete document",
      message:
        labels?.message ??
        "Are you sure you want to delete this document? This action cannot be undone.",
      onClose: cancelDelete,
      onConfirm: () => {
        void confirmDelete();
      },
    };
  }, [pendingDelete, deletingId, cancelDelete, confirmDelete]);

  return {
    deletingId,
    requestDelete,
    deleteConfirmProps,
  };
}
