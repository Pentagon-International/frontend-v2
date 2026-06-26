import { useCallback, useState } from "react";
import { URL } from "../api/serverUrls";
import { ToastNotification } from "../components";
import { postAPICall } from "../service/postApiCall";
import { API_HEADER } from "../store/storeKeys";
import {
  buildDocumentModalRowsFromDisplayList,
  EMPTY_JOB_DOCUMENT_MODAL_ROW,
  parseJobDocumentsFromApi,
  type JobDocumentDisplayItem,
  type JobDocumentModalRow,
  type JobDocumentsNavigationState,
} from "../utils/jobDocuments";

type UploadDocumentItem = {
  id?: number;
  document_name?: string;
  document_url?: string;
  user_file_name?: string;
};

function normalizeUploadResponse(
  raw: unknown,
): UploadDocumentItem[] {
  if (
    raw &&
    Array.isArray((raw as { documents?: UploadDocumentItem[] }).documents)
  ) {
    return (raw as { documents?: UploadDocumentItem[] }).documents ?? [];
  }
  if (Array.isArray(raw)) {
    return raw as UploadDocumentItem[];
  }
  if (raw) {
    return [raw as UploadDocumentItem];
  }
  return [];
}

export function useJobDocuments() {
  const [document_ids, setDocumentIds] = useState<number[]>([]);
  const [document_display_list, setDocumentDisplayList] = useState<
    JobDocumentDisplayItem[]
  >([]);
  const [document_modal_rows, setDocumentModalRows] = useState<
    JobDocumentModalRow[]
  >([{ ...EMPTY_JOB_DOCUMENT_MODAL_ROW }]);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);

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
      if (Array.isArray(state.document_ids)) {
        setDocumentIds(state.document_ids);
      }
      if (Array.isArray(state.document_display_list)) {
        setDocumentDisplayList(state.document_display_list);
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

  const openDocumentsModal = useCallback(() => {
    setDocumentModalRows(
      buildDocumentModalRowsFromDisplayList(document_display_list),
    );
    setDocumentsModalOpen(true);
  }, [document_display_list]);

  const addDocumentRow = useCallback(() => {
    setDocumentModalRows((rows) => [
      ...rows,
      { ...EMPTY_JOB_DOCUMENT_MODAL_ROW },
    ]);
  }, []);

  const updateDocumentRow = useCallback(
    (
      index: number,
      field: "documentName" | "file" | "document_url",
      value: string | File | null | undefined,
    ) => {
      setDocumentModalRows((rows) =>
        rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const removeDocumentRow = useCallback((index: number) => {
    setDocumentModalRows((rows) =>
      rows.length > 1 ? rows.filter((_, i) => i !== index) : rows,
    );
  }, []);

  const handleSubmitDocumentsModal = useCallback(async () => {
    const rows = document_modal_rows;
    const items = rows
      .map((row, index) => ({ row, index }))
      .filter(
        (item) =>
          item.row.documentName.trim() &&
          (item.row.id != null || item.row.file != null),
      );
    const invalid = rows.some(
      (r) =>
        (r.documentName.trim() && !r.file && r.id == null) ||
        (!r.documentName.trim() && (r.file || r.id != null)),
    );
    if (invalid) {
      ToastNotification({
        type: "warning",
        message:
          "Each row must have document name and either an existing document or a new file",
      });
      return;
    }
    if (items.length === 0) {
      ToastNotification({
        type: "warning",
        message:
          "Please add at least one document (name + file) or leave all rows empty",
      });
      return;
    }

    setDocumentUploading(true);
    try {
      const formData = new FormData();
      items.forEach(({ row }, i) => {
        formData.append(`document_names[${i}]`, row.documentName.trim());
        if (row.file != null) {
          formData.append(`documents[${i}]`, row.file);
        }
        if (row.id != null) {
          formData.append(`document_id[${i}]`, String(row.id));
        }
      });

      const headers = {
        "Content-Type": "multipart/form-data",
        ...API_HEADER.headers,
      };

      const response = (await postAPICall(URL.uploadDocument, formData, {
        headers,
      })) as { success?: boolean; data?: unknown; message?: string };

      if (response?.success) {
        const normalized = normalizeUploadResponse(response.data);
        const newIds = normalized
          .filter((d) => d.id != null)
          .map((d) => Number(d.id!));
        const updatedDisplayList = normalized.map((d) => ({
          id: Number(d.id ?? 0),
          documentName: String(d.document_name ?? ""),
          userFileName: String(d.user_file_name ?? ""),
          document_url:
            d.document_url != null ? String(d.document_url) : undefined,
        }));

        setDocumentIds(newIds);
        setDocumentDisplayList(updatedDisplayList);
        setDocumentModalRows(
          buildDocumentModalRowsFromDisplayList(updatedDisplayList),
        );
        ToastNotification({
          type: "success",
          message: "Document(s) saved successfully",
        });
        setDocumentsModalOpen(false);
      } else {
        ToastNotification({
          type: "error",
          message:
            (response as { message?: string })?.message ??
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
  }, [document_modal_rows]);

  return {
    document_ids,
    document_display_list,
    document_modal_rows,
    documentsModalOpen,
    setDocumentsModalOpen,
    documentUploading,
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
