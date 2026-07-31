import { useCallback, useState } from "react";
import { URL } from "../api/serverUrls";
import { ToastNotification } from "../components";
import { postAPICall } from "../service/postApiCall";
import { API_HEADER } from "../store/storeKeys";
import {
  appendDocumentsToFormData,
  buildDisplayListFromModalRows,
  buildDocumentModalRowsFromDisplayList,
  EMPTY_JOB_DOCUMENT_MODAL_ROW,
  extractUploadDocumentsFromApiBody,
  fetchDocumentTypeMasterOptions,
  isDocumentUploadSuccessful,
  mapUploadDocumentsToDisplayList,
  parseJobDocumentsFromApi,
  unwrapPostApiResponseBody,
  validateDocumentModalRows,
  type DocumentTypeMasterOption,
  type JobDocumentDisplayItem,
  type JobDocumentModalRow,
  type JobDocumentsNavigationState,
} from "../utils/jobDocuments";

type UseJobDocumentsOptions = {
  uploadEndpoint?: string;
  onDocumentsUpdated?: (state: JobDocumentsNavigationState) => void;
};

export function useJobDocuments(options: UseJobDocumentsOptions = {}) {
  const { uploadEndpoint = URL.jobCreateUploadDocument, onDocumentsUpdated } =
    options;
  const [document_ids, setDocumentIds] = useState<number[]>([]);
  const [document_display_list, setDocumentDisplayList] = useState<
    JobDocumentDisplayItem[]
  >([]);
  const [document_modal_rows, setDocumentModalRows] = useState<
    JobDocumentModalRow[]
  >([{ ...EMPTY_JOB_DOCUMENT_MODAL_ROW }]);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [docTypeOptions, setDocTypeOptions] = useState<
    DocumentTypeMasterOption[]
  >([]);
  const [docCodeErrors, setDocCodeErrors] = useState<Record<number, string>>(
    {},
  );

  const applyDocumentsState = useCallback(
    (
      updatedDisplayList: JobDocumentDisplayItem[],
      modalRows?: JobDocumentModalRow[],
    ) => {
      const newIds = updatedDisplayList.map((d) => d.id);
      const nextModalRows =
        modalRows ?? buildDocumentModalRowsFromDisplayList(updatedDisplayList);
      setDocumentIds(newIds);
      setDocumentDisplayList(updatedDisplayList);
      setDocumentModalRows(nextModalRows);
      onDocumentsUpdated?.({
        document_ids: newIds,
        document_display_list: updatedDisplayList,
        document_modal_rows: nextModalRows,
      });
    },
    [onDocumentsUpdated],
  );

  const initFromJobData = useCallback(
    (data: Record<string, unknown> | null | undefined) => {
      const parsed = parseJobDocumentsFromApi(data);
      setDocumentIds(parsed.document_ids);
      setDocumentDisplayList(parsed.document_display_list);
      setDocumentModalRows(parsed.document_modal_rows);
    },
    [],
  );

  const restoreFromNavigationState = useCallback(
    (state: Partial<JobDocumentsNavigationState> | null | undefined) => {
      if (!state) return;
      if (Array.isArray(state.document_display_list)) {
        setDocumentDisplayList(state.document_display_list);
        // Prefer display list as source of truth so deleted docs stay removed
        setDocumentIds(state.document_display_list.map((d) => Number(d.id)));
      } else if (Array.isArray(state.document_ids)) {
        setDocumentIds(state.document_ids);
      }
      if (
        Array.isArray(state.document_modal_rows) &&
        state.document_modal_rows.length > 0
      ) {
        setDocumentModalRows(state.document_modal_rows);
      }
    },
    [],
  );

  const getNavigationState = useCallback(
    (): JobDocumentsNavigationState => ({
      document_ids,
      document_display_list,
      document_modal_rows,
    }),
    [document_ids, document_display_list, document_modal_rows],
  );

  const loadDocTypeOptions = useCallback(async () => {
    if (docTypeOptions.length > 0) return;
    const options = await fetchDocumentTypeMasterOptions();
    setDocTypeOptions(options);
  }, [docTypeOptions.length]);

  const openDocumentsModal = useCallback(() => {
    setDocCodeErrors({});
    setDocumentModalRows(
      buildDocumentModalRowsFromDisplayList(document_display_list),
    );
    void loadDocTypeOptions();
    setDocumentsModalOpen(true);
  }, [document_display_list, loadDocTypeOptions]);

  const addDocumentRow = useCallback(() => {
    setDocumentModalRows((rows) => [
      ...rows,
      { ...EMPTY_JOB_DOCUMENT_MODAL_ROW },
    ]);
  }, []);

  const updateDocumentRow = useCallback(
    (
      index: number,
      field: "documentName" | "doc_code" | "file" | "document_url",
      value: string | File | null | undefined,
    ) => {
      if (field === "doc_code" && String(value ?? "").trim()) {
        setDocCodeErrors((prev) => {
          if (!prev[index]) return prev;
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
      setDocumentModalRows((rows) =>
        rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const removeDocumentRow = useCallback(
    (index: number) => {
      setDocCodeErrors({});
      if (document_modal_rows.length <= 1) return;

      const nextRows = document_modal_rows.filter((_, i) => i !== index);
      // Drop deleted doc ids immediately so Update payload stays in sync even
      // before Attach, and Attach commits the same remaining set.
      const nextDisplayList = buildDisplayListFromModalRows(nextRows);
      applyDocumentsState(nextDisplayList, nextRows);
    },
    [applyDocumentsState, document_modal_rows],
  );

  const handleSubmitDocumentsModal = useCallback(async () => {
    const rows = document_modal_rows;
    const validation = validateDocumentModalRows(rows);
    if (!validation.valid) {
      if (validation.docCodeErrors) {
        setDocCodeErrors(validation.docCodeErrors);
        return;
      }
      ToastNotification({
        type: "warning",
        message: validation.message ?? "Please complete all document fields",
      });
      return;
    }
    setDocCodeErrors({});
    if (validation.allowEmptyClose) {
      const emptyRows = [{ ...EMPTY_JOB_DOCUMENT_MODAL_ROW }];
      applyDocumentsState([], emptyRows);
      setDocumentsModalOpen(false);
      return;
    }

    const items = validation.items;

    const buildDisplayListFromItems = (
      uploaded: JobDocumentDisplayItem[] = [],
    ): JobDocumentDisplayItem[] => {
      const fromRows: JobDocumentDisplayItem[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const { row } = items[i];
        const apiDoc =
          (row.id != null
            ? uploaded.find((d) => d.id === Number(row.id))
            : undefined) ?? uploaded[i];
        const id =
          apiDoc?.id ?? (row.id != null ? Number(row.id) : null);
        if (id == null || !Number.isFinite(id)) continue;
        const userFileName =
          apiDoc?.userFileName ||
          row.userFileName ||
          row.file?.name ||
          "";
        const doc_code =
          apiDoc?.doc_code || row.doc_code?.trim() || undefined;
        fromRows.push({
          id,
          documentName: (apiDoc?.documentName || row.documentName).trim(),
          ...(doc_code ? { doc_code } : {}),
          ...(userFileName ? { userFileName } : {}),
          document_url: apiDoc?.document_url || row.document_url,
        });
      }

      // Prefer explicit remaining modal rows so deletes always stick
      return fromRows.length > 0
        ? fromRows
        : buildDisplayListFromModalRows(rows);
    };

    // Deleting/keeping existing docs with no new files: sync local state only.
    const hasNewFiles = items.some(({ row }) => row.file != null);
    if (!hasNewFiles) {
      applyDocumentsState(buildDisplayListFromItems());
      ToastNotification({
        type: "success",
        message: "Document(s) saved successfully",
      });
      setDocumentsModalOpen(false);
      return;
    }

    setDocumentUploading(true);
    try {
      const formData = new FormData();
      appendDocumentsToFormData(formData, items);

      const headers = {
        "Content-Type": "multipart/form-data",
        ...API_HEADER.headers,
      };

      const rawResponse = await postAPICall(uploadEndpoint, formData, {
        headers,
      });
      const body = unwrapPostApiResponseBody(rawResponse);

      if (isDocumentUploadSuccessful(body)) {
        const uploadedItems = extractUploadDocumentsFromApiBody(body);
        const fromApi = mapUploadDocumentsToDisplayList(uploadedItems);
        // Modal rows are the source of truth — do not merge with prior display list
        // or deleted documents would reappear in the update payload.
        applyDocumentsState(buildDisplayListFromItems(fromApi));
        ToastNotification({
          type: "success",
          message:
            String(body.message ?? "").trim() ||
            "Document(s) saved successfully",
        });
        setDocumentsModalOpen(false);
      } else {
        ToastNotification({
          type: "error",
          message:
            String(body.message ?? "").trim() ||
            "Upload failed for one or more documents",
        });
      }
    } catch (err) {
      console.error("Document upload error:", err);
      ToastNotification({
        type: "error",
        message: "Failed to upload document(s)",
      });
    } finally {
      setDocumentUploading(false);
    }
  }, [applyDocumentsState, document_modal_rows, uploadEndpoint]);

  return {
    document_ids,
    document_display_list,
    document_modal_rows,
    documentsModalOpen,
    setDocumentsModalOpen,
    documentUploading,
    docTypeOptions,
    docCodeErrors,
    initFromJobData,
    restoreFromNavigationState,
    getNavigationState,
    openDocumentsModal,
    addDocumentRow,
    updateDocumentRow,
    removeDocumentRow,
    handleSubmitDocumentsModal,
  };
}
